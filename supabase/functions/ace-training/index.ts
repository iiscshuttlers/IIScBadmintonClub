import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ACE training proxy for the Training tab on the personal page.
 *
 * The ACE API secret lives only here (ACE_API_SECRET); it used to be a VITE_
 * variable and so shipped inside the web bundle and the APK. The email sent to
 * ACE is the caller's verified Supabase email, never a client-supplied value,
 * so one member can't read another member's training data.
 *
 * GET with the caller's JWT. Responds with ACE's JSON body and status as-is.
 * Secrets: ACE_API_URL, ACE_API_SECRET (`supabase secrets set ...`).
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ACE_API_URL = Deno.env.get("ACE_API_URL");
const ACE_API_SECRET = Deno.env.get("ACE_API_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!ACE_API_URL || !ACE_API_SECRET) return json({ error: "ACE is not configured" }, 503);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Sign in required" }, 401);

  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await supabase.auth.getUser(jwt);
  const email = data?.user?.email;
  if (error || !email) return json({ error: "Sign in with an email account to see ACE data" }, 401);

  try {
    const url = new URL(ACE_API_URL);
    url.searchParams.set("email", email);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${ACE_API_SECRET}` } });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...cors, "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (e) {
    console.error("ace-training upstream error", e);
    return json({ error: "Could not reach ACE" }, 502);
  }
});
