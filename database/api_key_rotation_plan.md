# API Key Rotation Plan

Run this checklist whenever rotating any credential. Target: rotate at least once per year, or immediately after a suspected leak.

---

## Keys in scope

| Key | Where stored | Used by |
|-----|-------------|---------|
| `SUPABASE_ANON_KEY` | `.env`, `capacitor.config.ts` | All client queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets | Edge Functions, admin-users fn |
| `FIREBASE_SERVICE_ACCOUNT` | Supabase Edge Function secrets | notify-match, push Edge Functions |
| `FCM_SERVER_KEY` | Supabase Edge Function secrets | Legacy FCM v1 fallback |
| Firebase Web API key (`firebaseConfig.apiKey`) | `client/src/lib/firebase.ts` | Firestore live bracket |
| Supabase JWT secret | Supabase project settings | All JWT validation |

---

## Rotation steps

### 1. Supabase Anon Key

1. Go to **Supabase Dashboard → Project Settings → API**.
2. Click **Regenerate** next to `anon` key.
3. Update `.env` (local), `capacitor.config.ts`, and any CI/CD secrets.
4. Redeploy the web app (`npm run build && deploy`).
5. Publish a new APK if the key is baked into the Android build.
6. Verify login still works in browser and on device.

### 2. Supabase Service Role Key

1. Regenerate in **Supabase Dashboard → Project Settings → API**.
2. Update Supabase Edge Function secrets:
   ```
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new-key>
   ```
3. Redeploy all Edge Functions:
   ```
   supabase functions deploy --no-verify-jwt
   ```
4. Test: invoke `notify-match` manually and confirm it succeeds.

### 3. Firebase Service Account

1. Go to **Firebase Console → Project Settings → Service Accounts**.
2. Click **Generate new private key** — download JSON.
3. Update the Supabase Edge Function secret:
   ```
   supabase secrets set FIREBASE_SERVICE_ACCOUNT='<minified-json>'
   ```
4. Delete the old service account key from Firebase Console.
5. Redeploy `notify-match` and test a push notification.

### 4. FCM Server Key (legacy)

1. Go to **Firebase Console → Project Settings → Cloud Messaging → Server key**.
2. Regenerate the key.
3. Update secret: `supabase secrets set FCM_SERVER_KEY=<new-key>`
4. Redeploy `remind-pending-matches` and test.

### 5. Firebase Web API Key

> Firebase Web API keys are not secret by default (they identify the project, not authenticate server calls). Restrict them instead of rotating:
> 1. Go to **Google Cloud Console → APIs & Services → Credentials**.
> 2. Click the API key → **Application restrictions** → restrict to the app's domain.
> 3. **API restrictions** → allow only Firebase-related APIs.

### 6. Supabase JWT Secret

> **High-impact** — all existing sessions are invalidated.

1. Go to **Supabase Dashboard → Project Settings → Auth → JWT Settings**.
2. Click **Rotate JWT secret**.
3. All users will be logged out on next request.
4. Announce downtime if necessary.

---

## Post-rotation checklist

- [ ] Auth login works (web + Android)
- [ ] Match logging works (calls `submit_friendly_match` RPC)
- [ ] Push notification fires on new match
- [ ] Admin panel loads player list
- [ ] Find & Lost real-time subscription works
- [ ] No 401/403 errors in Supabase logs

---

## Leak response

If a key is suspected leaked:
1. Rotate it **immediately** (steps above).
2. Check Supabase logs for unusual read/write patterns.
3. Check Firebase Console for anomalous FCM sends.
4. Review `admin_logs` table for unauthorized admin actions.
5. Notify club admins.
