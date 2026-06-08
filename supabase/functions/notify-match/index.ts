import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";
// JWT generation for Firebase
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getFirebaseAccessToken(): Promise<string> {
  const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!serviceAccountStr) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  }

  const serviceAccount = JSON.parse(serviceAccountStr);
  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');

  const jwt = await new SignJWT({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to get Google OAuth token: ${data.error_description}`);
  }

  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('[notify-match] Received payload:', JSON.stringify(payload).slice(0, 500));

    // 1. Validate payload comes from our webhook
    if (payload.type !== 'INSERT' || payload.table !== 'matches') {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const matchRecord = payload.record;
    
    // We only notify if it's a pending match (a challenge)
    if (matchRecord.status !== 'pending') {
      console.log('[notify-match] Not a pending match, skipping');
      return new Response(JSON.stringify({ message: "Not a pending match, skipped" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const player1Id = matchRecord.player1_id;
    const player2Id = matchRecord.player2_id;
    console.log(`[notify-match] Challenge: ${player1Id} -> ${player2Id}`);

    // 2. Fetch Player 1's Name (the Challenger)
    const { data: challenger, error: challengerError } = await supabaseClient
      .from('players')
      .select('full_name')
      .eq('id', player1Id)
      .single();

    if (challengerError || !challenger) {
      console.error('[notify-match] Could not find challenger:', challengerError);
      // Don't crash — just use a fallback name
      // throw new Error("Could not find challenger info");
    }

    const challengerName = challenger?.full_name || 'Someone';

    // 3. Fetch Player 2's Push Tokens (the Challenged)
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('push_tokens')
      .select('token')
      .eq('user_id', player2Id);

    console.log(`[notify-match] Found ${tokens?.length ?? 0} push tokens for ${player2Id}`);

    if (tokensError) {
      console.error('[notify-match] Error fetching tokens:', tokensError);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: `No push tokens found for user ${player2Id}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Also check for doubles partners
    const partnerIds = [
      matchRecord.team1_partner_id,
      matchRecord.team2_partner_id,
    ].filter(Boolean);

    // Collect all tokens for all notified players
    let allTokensToSend = [...tokens];
    for (const partnerId of partnerIds) {
      if (partnerId && partnerId !== player1Id) {
        const { data: partnerTokens } = await supabaseClient
          .from('push_tokens')
          .select('token')
          .eq('user_id', partnerId);
        if (partnerTokens) allTokensToSend.push(...partnerTokens);
      }
    }

    // Deduplicate tokens
    const uniqueTokens = [...new Map(allTokensToSend.map(t => [t.token, t])).values()];

    const fcmAccessToken = await getFirebaseAccessToken();
    const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!;
    const projectId = JSON.parse(serviceAccountStr).project_id;

    const notificationTitle = "🏸 New Match Challenge!";
    const notificationBody = `${challengerName} has just logged a match against you. Open the app to confirm.`;

    console.log(`[notify-match] Sending ${uniqueTokens.length} FCM notifications`);

    const results = await Promise.allSettled(uniqueTokens.map(async (t) => {
      const fcmPayload = {
        message: {
          token: t.token,
          notification: {
            title: notificationTitle,
            body: notificationBody,
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "match_alerts",
            }
          },
          data: {
            matchId: matchRecord.id,
            action: "view_match",
          },
        },
      };

      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${fcmAccessToken}`,
        },
        body: JSON.stringify(fcmPayload),
      });

      const resBody = await res.text();

      if (!res.ok) {
        console.error(`[notify-match] FCM error for token ${t.token.slice(0, 20)}...:`, resBody);

        // If token is invalid/expired, remove it from the DB
        if (res.status === 404 || res.status === 400) {
          console.log(`[notify-match] Removing stale token ${t.token.slice(0, 20)}...`);
          await supabaseClient.from('push_tokens').delete().eq('token', t.token);
        }

        throw new Error(`FCM ${res.status}: ${resBody}`);
      }

      return resBody;
    }));

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[notify-match] Done. Sent: ${succeeded}, Failed: ${failed}`);

    return new Response(JSON.stringify({ message: `Sent ${succeeded}/${uniqueTokens.length} notifications` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error("[notify-match] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
