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

    // 1. Validate payload comes from our webhook
    if (payload.type !== 'INSERT' || payload.table !== 'matches') {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const matchRecord = payload.record;
    
    // We only notify if it's a pending match (a challenge)
    if (matchRecord.status !== 'pending') {
      return new Response(JSON.stringify({ message: "Not a pending match, skipped" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const player1Id = matchRecord.player1_id;
    const player2Id = matchRecord.player2_id;

    // 2. Fetch Player 1's Name (the Challenger)
    const { data: challenger, error: challengerError } = await supabaseClient
      .from('players')
      .select('full_name')
      .eq('id', player1Id)
      .single();

    if (challengerError || !challenger) {
      throw new Error("Could not find challenger info");
    }

    // 3. Fetch Player 2's Push Tokens (the Challenged)
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('push_tokens')
      .select('token')
      .eq('user_id', player2Id);

    if (tokensError || !tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No push tokens found for user" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const fcmAccessToken = await getFirebaseAccessToken();
    const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!;
    const projectId = JSON.parse(serviceAccountStr).project_id;

    const notificationTitle = "🏸 New Match Challenge!";
    const notificationBody = `${challenger.full_name} has just logged a match against you. Open the app to confirm.`;

    const sendPromises = tokens.map(async (t) => {
      const fcmPayload = {
        message: {
          token: t.token,
          notification: {
            title: notificationTitle,
            body: notificationBody,
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

      if (!res.ok) {
        console.error(`FCM error for token ${t.token}:`, await res.text());
      }
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ message: `Sent ${tokens.length} notifications` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error("Error sending push notification:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
