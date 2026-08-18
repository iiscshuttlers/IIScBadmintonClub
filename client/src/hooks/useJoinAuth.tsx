import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useFormDraft } from "@/hooks/useFormDraft";
import { toast } from "sonner";
import {
  biometricSignIn,
  enableBiometricLogin,
  getBiometricEmail,
  isBiometricAvailable,
  isBiometricEnabled,
} from "@/lib/biometricAuth";

export type Mode = "welcome" | "signin" | "signup" | "otp-email" | "otp-verify";

export function getPasswordStrength(pwd: string) {
  let score = 0;
  if (!pwd) return 0;
  if (pwd.length >= 8) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  return score;
}

export function useJoinAuth() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useFormDraft<Mode>("join-auth-mode", "welcome");
  const [email, setEmail] = useFormDraft("join-auth-email", "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [otp, setOtp] = useState("");
  const [infoMsg, setInfoMsg] = useState<React.ReactNode>("");
  const [errorMsg, setErrorMsg] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [inactivityLogout, setInactivityLogout] = useState(false);

  // Native-only. Stays false on web/PWA, so the sign-in UI is unchanged there.
  const [biometricReady, setBiometricReady] = useState(false);
  const biometricEmail = getBiometricEmail();

  const { session, profile, isInitializing } = useAuth();

  useEffect(() => {
    let cancelled = false;
    if (!isBiometricEnabled()) return;
    isBiometricAvailable().then((available) => {
      if (!cancelled) setBiometricReady(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = () => {
    setPassword("");
    setConfirm("");
    setOtp("");
    setInfoMsg("");
    setErrorMsg("");
  };

  useEffect(() => {
    if (sessionStorage.getItem("logout_reason") === "inactivity") {
      sessionStorage.removeItem("logout_reason");
      setInactivityLogout(true);
    }
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    if (!session) return;
    if (new URLSearchParams(window.location.search).get("add_account") === "true") return;

    if (profile) {
      const returnUrl = sessionStorage.getItem("return_url");
      if (returnUrl) {
        sessionStorage.removeItem("return_url");
        setLocation(returnUrl);
      } else {
        setLocation("/");
      }
    } else {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      if (hashParams.get("type") === "signup" || hashParams.get("type") === "magiclink") {
        toast.success("Account verified successfully! Please complete your profile.", { duration: 5000 });
      }
      setLocation("/profile/setup");
    }
  }, [isInitializing, session, profile, setLocation]);

  /**
   * After a successful sign-in on a native device, offer to store the session
   * behind biometrics. Silent on web, silent if already enrolled, and wrapped
   * so a failure here can never break the sign-in it follows.
   */
  const offerBiometricEnrolment = async (newSession: Session | null) => {
    try {
      if (isBiometricEnabled()) return;
      if (!(await isBiometricAvailable())) return;
      toast("Enable fingerprint sign-in?", {
        description: "Skip typing your password next time on this device.",
        duration: 10000,
        action: {
          label: "Enable",
          onClick: async () => {
            if (await enableBiometricLogin(newSession)) {
              toast.success("Fingerprint sign-in enabled");
            }
          },
        },
      });
    } catch {
      /* enrolment is entirely optional */
    }
  };

  const handleBiometricSignIn = async () => {
    setLoading(true);
    setErrorMsg("");
    const result = await biometricSignIn();

    if (result === "ok") {
      sessionStorage.removeItem("guest_mode");
      return; // the redirect effect above takes it from here
    }

    setLoading(false);
    if (result === "expired") {
      setBiometricReady(false);
      setErrorMsg("Fingerprint sign-in expired. Sign in with your password once to re-enable it.");
    }
    // "cancelled" — the user dismissed the prompt; stay quiet.
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setInfoMsg("");

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out. Check your connection and try again.")), 15000)
    );

    try {
      const { data, error } = (await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout,
      ])) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
      if (error) throw error;
      if (!data.session) throw new Error("Sign in failed — no session returned. Please try again.");
      
      sessionStorage.removeItem("guest_mode");
      offerBiometricEnrolment(data.session);
      if (new URLSearchParams(window.location.search).get("add_account") === "true") {
        setLocation("/");
      }
    } catch (err: any) {
      const msg = typeof err?.message === "string" && err.message !== "{}" ? err.message : "";
      if (err?.status === 504 || err?.name === "AuthRetryableFetchError" || msg.includes("timed out")) {
        setErrorMsg("Server timed out. Please check your connection and try again.");
      } else if (msg === "Email not confirmed") {
        setErrorMsg("Email not confirmed");
      } else if (msg.toLowerCase().includes("invalid")) {
        setErrorMsg("Incorrect email or password.");
      } else {
        setErrorMsg(msg || "An unexpected error occurred during sign in.");
      }
      setLoading(false);
    }
  };

  const handleResendLink = async () => {
    setLoading(true);
    setErrorMsg("");
    setInfoMsg("");
    try {
      const redirectUrl = "https://iiscshuttlers.github.io/IIScBadmintonClub/login-callback";
      const { error } = await supabase.auth.resend({ 
        type: "signup", 
        email,
        options: { emailRedirectTo: redirectUrl }
      });
      if (error) throw error;
      setInfoMsg("A new verification link has been sent to your email!");
    } catch (err: any) {
      const msg = typeof err?.message === "string" && err.message !== "{}" ? err.message : "";
      setErrorMsg(msg || "Failed to resend verification link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setErrorMsg("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErrorMsg("Passwords do not match."); return; }
    if (!agreedToTerms) { setErrorMsg("You must agree to the Privacy Policy and Terms of Service."); return; }
    
    setLoading(true);
    setErrorMsg("");
    try {
      const { data: emailExists, error: rpcError } = await supabase.rpc("check_email_exists", { lookup_email: email });
      if (rpcError) {
        console.warn("RPC check_email_exists warning:", rpcError);
      } else if (emailExists) {
        setErrorMsg("You already have an account! Please go to Sign In (if you haven't verified yet, log in to resend the link).");
        setLoading(false);
        return;
      }

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Please check your connection and try again.")), 15000)
      );

      // ALWAYS explicitly set the HTTPS Universal Link.
      // This guarantees the link works on PC (opening the web app) AND on Android (opening the native app via App Links)
      const redirectUrl = "https://iiscshuttlers.github.io/IIScBadmintonClub/login-callback";

      const { data, error } = (await Promise.race([
        supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        }),
        timeout,
      ])) as Awaited<ReturnType<typeof supabase.auth.signUp>>;

      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        setErrorMsg("This email is already registered. Please Sign In, or use 'Forgot password? OTP' if you forgot your password.");
        setLoading(false);
        return;
      }

      if (error) throw error;
      if (!data?.session) {
        setInfoMsg("Verification link sent! Check Junk/Spam for IISc emails. If it never arrives, please try signing up with a personal Gmail account.");
        setMode("signin");
        setLoading(false);
      } else if (new URLSearchParams(window.location.search).get("add_account") === "true") {
        setLocation("/");
      }
    } catch (err: any) {
      const msg = typeof err?.message === "string" && err.message !== "{}" ? err.message : "";
      if (err?.status === 504 || err?.name === "AuthRetryableFetchError" || msg.includes("timed out")) {
        setErrorMsg("Server verification request timed out. The email service may be busy — please wait a moment and try signing in or requesting an OTP.");
      } else if (msg.includes("already registered") || msg.includes("already exists")) {
        setErrorMsg("This email is already registered. Please Sign In, or use 'Forgot password? OTP' if you forgot your password.");
      } else {
        setErrorMsg(msg || "An unexpected error occurred during account creation.");
      }
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const redirectUrl = `${window.location.origin}${import.meta.env.BASE_URL}login-callback`;
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectUrl },
      });
      if (error) throw error;
      setMode("otp-verify");
      setInfoMsg("Login code sent! Check Junk/Spam for IISc emails. If it never arrives, please try a personal Gmail account.");
    } catch (err: any) {
      const msg: string = typeof err?.message === "string" && err.message !== "{}" ? err.message : "";
      setErrorMsg(msg.includes("not found") ? "No account found with this email. Please sign up first." : msg || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
      if (error) throw error;
      if (!data.session) setLoading(false);
      else if (new URLSearchParams(window.location.search).get("add_account") === "true") setLocation("/");
    } catch (err: any) {
      setErrorMsg("Invalid or expired code. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "https://iiscshuttlers.github.io/IIScBadmintonClub/login-callback",
        },
      });
      if (error) throw error;
    } catch (err: any) {
      const msg = typeof err?.message === "string" && err.message !== "{}" ? err.message : "";
      setErrorMsg(msg || "Failed to initialize Google Sign In.");
      setLoading(false);
    }
  };

  return {
    mode, setMode, loading, email, setEmail, password, setPassword,
    confirm, setConfirm, showPwd, setShowPwd, otp, setOtp,
    infoMsg, setInfoMsg, errorMsg, setErrorMsg, agreedToTerms, setAgreedToTerms,
    inactivityLogout, setInactivityLogout, reset,
    biometricReady, biometricEmail, handleBiometricSignIn,
    handleSignIn, handleSignUp, handleResendLink, handleSendOtp, handleVerifyOtp, handleGoogleSignIn
  };
}
