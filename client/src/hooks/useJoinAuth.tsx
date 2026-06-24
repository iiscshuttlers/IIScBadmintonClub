import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  const [mode, setMode] = useState<Mode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [otp, setOtp] = useState("");
  const [infoMsg, setInfoMsg] = useState<React.ReactNode>("");
  const [errorMsg, setErrorMsg] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [inactivityLogout, setInactivityLogout] = useState(false);

  const { session, profile, isInitializing } = useAuth();

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
      setLocation("/");
    }
  }, [isInitializing, session, profile, setLocation]);

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
      if (new URLSearchParams(window.location.search).get("add_account") === "true") {
        setLocation("/");
      }
    } catch (err: any) {
      const msg: string = err?.message ?? "An unexpected error occurred.";
      if (msg === "Email not confirmed") setErrorMsg("Email not confirmed");
      else if (msg.toLowerCase().includes("invalid")) setErrorMsg("Incorrect email or password.");
      else setErrorMsg(msg);
      setLoading(false);
    }
  };

  const handleResendLink = async () => {
    setLoading(true);
    setErrorMsg("");
    setInfoMsg("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setInfoMsg("A new verification link has been sent to your email!");
    } catch (err: any) {
      setErrorMsg(err.message);
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
      const { data: emailExists } = await supabase.rpc("check_email_exists", { lookup_email: email });
      if (emailExists) {
        setErrorMsg("You already have an account! Please go to Sign In (if you haven't verified yet, log in to resend the link).");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: "https://iiscshuttlers.github.io/iiscshuttlers/join" },
      });

      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        setErrorMsg("This email is already registered. Please Sign In, or use 'Forgot password? OTP' if you forgot your password.");
        return;
      }

      if (error) throw error;
      if (!data.session) {
        setInfoMsg("Verification link sent! Check Junk/Spam for IISc emails. If it never arrives, please try signing up with a personal Gmail account.");
        setMode("signin");
        setLoading(false);
      } else if (new URLSearchParams(window.location.search).get("add_account") === "true") {
        setLocation("/");
      }
    } catch (err: any) {
      if (err.message.includes("already registered") || err.message.includes("already exists")) {
        setErrorMsg("This email is already registered. Please Sign In, or use 'Forgot password? OTP' if you forgot your password.");
      } else {
        setErrorMsg(err.message);
      }
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: "https://iiscshuttlers.github.io/iiscshuttlers/join" },
      });
      if (error) throw error;
      setMode("otp-verify");
      setInfoMsg("Login code sent! Check Junk/Spam for IISc emails. If it never arrives, please try a personal Gmail account.");
    } catch (err: any) {
      const msg: string = err?.message ?? "";
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

  return {
    mode, setMode, loading, email, setEmail, password, setPassword,
    confirm, setConfirm, showPwd, setShowPwd, otp, setOtp,
    infoMsg, setInfoMsg, errorMsg, setErrorMsg, agreedToTerms, setAgreedToTerms,
    inactivityLogout, setInactivityLogout, reset,
    handleSignIn, handleSignUp, handleResendLink, handleSendOtp, handleVerifyOtp
  };
}
