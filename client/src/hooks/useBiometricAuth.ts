/**
 * Biometric authentication hook (#53).
 * Requires: npm install capacitor-native-biometric
 * Gracefully no-ops on web or when biometrics unavailable.
 */
import { useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

interface BiometricResult {
  available: boolean;
  verified: boolean;
  error?: string;
}

export function useBiometricAuth() {
  const [checking, setChecking] = useState(false);

  const checkAvailability = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      // Dynamic import to avoid build errors if plugin not installed
      const { NativeBiometric } = await import("capacitor-native-biometric");
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch {
      return false;
    }
  }, []);

  const authenticate = useCallback(async (reason = "Verify your identity"): Promise<BiometricResult> => {
    if (!Capacitor.isNativePlatform()) {
      return { available: false, verified: false };
    }

    setChecking(true);
    try {
      const { NativeBiometric } = await import("capacitor-native-biometric");

      const available = await NativeBiometric.isAvailable();
      if (!available.isAvailable) {
        return { available: false, verified: false };
      }

      await NativeBiometric.verifyIdentity({
        reason,
        title: "IISc Shuttlers",
        subtitle: "Biometric Login",
        description: reason,
        negativeButtonText: "Use Password",
        maxAttempts: 3,
      });

      return { available: true, verified: true };
    } catch (err: any) {
      return {
        available: true,
        verified: false,
        error: err?.message ?? "Biometric authentication failed",
      };
    } finally {
      setChecking(false);
    }
  }, []);

  return { authenticate, checkAvailability, checking };
}

// Persist biometric preference to localStorage
const BIOMETRIC_PREF_KEY = "biometric_auth_enabled";

export function getBiometricEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_PREF_KEY) === "true";
}

export function setBiometricEnabled(enabled: boolean) {
  localStorage.setItem(BIOMETRIC_PREF_KEY, enabled ? "true" : "false");
}
