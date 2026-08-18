import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

/**
 * Biometric (fingerprint / face) unlock for returning users.
 *
 * Native-only by design. Every entry point returns early on web/PWA, and the
 * plugin is pulled in with a dynamic import so the browser bundle never loads
 * or evaluates it — the website is unaffected whether or not the plugin
 * resolves.
 *
 * What is stored is the Supabase *refresh token*, never the password. It lives
 * in the platform keystore (Android Keystore / iOS Keychain) behind a biometric
 * prompt, and is revocable server-side by signing out everywhere.
 */

const SERVER = "iiscshuttlers.biometric";
const ENABLED_KEY = "iisc_biometric_enabled";
const EMAIL_KEY = "iisc_biometric_email";

type NativeBiometricApi = typeof import("capacitor-native-biometric")["NativeBiometric"];

/** Lazily resolve the plugin. Returns null on web or if the plugin is missing. */
async function getPlugin(): Promise<NativeBiometricApi | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import("capacitor-native-biometric");
    return mod.NativeBiometric;
  } catch (e) {
    console.warn("[Biometric] Plugin unavailable:", e);
    return null;
  }
}

function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode / storage disabled — biometric simply stays off */
  }
}

/** Whether the user has opted in on this device. Cheap, synchronous. */
export function isBiometricEnabled(): boolean {
  return Capacitor.isNativePlatform() && readFlag(ENABLED_KEY) === "true";
}

/** The email tied to the stored credential, for display on the sign-in button. */
export function getBiometricEmail(): string | null {
  return readFlag(EMAIL_KEY);
}

/** Whether this device has usable biometric hardware and an enrolled identity. */
export async function isBiometricAvailable(): Promise<boolean> {
  const NativeBiometric = await getPlugin();
  if (!NativeBiometric) return false;
  try {
    const result = await NativeBiometric.isAvailable();
    return !!result?.isAvailable;
  } catch (e) {
    console.warn("[Biometric] isAvailable check failed:", e);
    return false;
  }
}

/**
 * Opt in. Verifies identity once, then stores the session's refresh token.
 * Returns true only if the credential was actually saved.
 */
export async function enableBiometricLogin(session: Session | null): Promise<boolean> {
  const NativeBiometric = await getPlugin();
  if (!NativeBiometric) return false;

  const refreshToken = session?.refresh_token;
  const email = session?.user?.email;
  if (!refreshToken || !email) return false;

  try {
    await NativeBiometric.verifyIdentity({
      reason: "Confirm it's you to enable fingerprint sign-in",
      title: "Enable Fingerprint Sign-In",
      subtitle: email,
    });

    await NativeBiometric.setCredentials({
      username: email,
      password: refreshToken,
      server: SERVER,
    });

    writeFlag(ENABLED_KEY, "true");
    writeFlag(EMAIL_KEY, email);
    return true;
  } catch (e) {
    // User cancelled the prompt, or no identity enrolled.
    console.warn("[Biometric] Enable cancelled or failed:", e);
    return false;
  }
}

/** Opt out and wipe the stored credential. Safe to call unconditionally. */
export async function disableBiometricLogin(): Promise<void> {
  writeFlag(ENABLED_KEY, null);
  writeFlag(EMAIL_KEY, null);

  const NativeBiometric = await getPlugin();
  if (!NativeBiometric) return;
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch (e) {
    console.warn("[Biometric] Failed to clear stored credentials:", e);
  }
}

/**
 * Prompt for biometrics and exchange the stored refresh token for a session.
 *
 * Supabase rotates refresh tokens on every use, so the freshly issued one is
 * written back immediately — otherwise the stored token would be spent and the
 * next biometric sign-in would fail.
 */
export type BiometricSignInResult = "ok" | "cancelled" | "expired" | "unavailable";

export async function biometricSignIn(): Promise<BiometricSignInResult> {
  const NativeBiometric = await getPlugin();
  if (!NativeBiometric || !isBiometricEnabled()) return "unavailable";

  let refreshToken: string;
  try {
    await NativeBiometric.verifyIdentity({
      reason: "Sign in to IISc Shuttlers",
      title: "Fingerprint Sign-In",
      subtitle: getBiometricEmail() ?? undefined,
    });

    const credentials = await NativeBiometric.getCredentials({ server: SERVER });
    if (!credentials?.password) return "expired";
    refreshToken = credentials.password;
  } catch (e) {
    console.warn("[Biometric] Verification cancelled or failed:", e);
    return "cancelled";
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) throw error ?? new Error("No session returned");

    await storeRefreshToken(data.session);
    return "ok";
  } catch (e) {
    // Token revoked, expired, or already rotated elsewhere. Force re-enrolment
    // rather than leaving a credential that can never succeed.
    console.warn("[Biometric] Refresh token rejected, clearing enrolment:", e);
    await disableBiometricLogin();
    return "expired";
  }
}

/**
 * Keep the stored token in step with Supabase's rotation. Call on TOKEN_REFRESHED.
 * No-op unless the user has opted in.
 */
export async function storeRefreshToken(session: Session | null): Promise<void> {
  if (!isBiometricEnabled()) return;

  const NativeBiometric = await getPlugin();
  if (!NativeBiometric) return;

  const refreshToken = session?.refresh_token;
  const email = session?.user?.email;
  if (!refreshToken || !email) return;

  try {
    await NativeBiometric.setCredentials({
      username: email,
      password: refreshToken,
      server: SERVER,
    });
    writeFlag(EMAIL_KEY, email);
  } catch (e) {
    console.warn("[Biometric] Failed to refresh stored credential:", e);
  }
}
