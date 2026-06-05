import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ShieldCheck, ArrowRight, KeyRound, Lock, Eye, EyeOff, UserPlus, LogIn, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

type Mode = "welcome" | "signin" | "signup" | "otp-email" | "otp-verify";

import { ADMIN_EMAILS } from "@/lib/admin";

const IISC_DOMAIN = "@iisc.ac.in";

function validateEmail(email: string) {
  // We now allow any email address to sign up, per user request.
  return null;
}


export default function Join() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [otp, setOtp] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Read inactivity logout reason set by App.tsx
  const [inactivityLogout, setInactivityLogout] = useState(false);

  const reset = () => { setPassword(""); setConfirm(""); setOtp(""); setInfoMsg(""); setErrorMsg(""); };

  const { session, loading: authLoading } = useSupabaseSession();

  // Show inactivity banner if redirected here after timeout
  useEffect(() => {
    if (sessionStorage.getItem("logout_reason") === "inactivity") {
      sessionStorage.removeItem("logout_reason");
      setInactivityLogout(true);
    }
  }, []);

  // Redirect if already logged in unless adding a new account
  useEffect(() => {
    if (authLoading) return; // wait for session resolution — prevents premature redirect on slow networks
    if (!session) return;
    if (new URLSearchParams(window.location.search).get("add_account") === "true") return;

    const fallbackTimeout = new Promise<{data: null, error: Error}>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error("Redirect lookup timed out") }), 8000)
    );

    Promise.race([
      supabase.from("players").select("id").eq("user_id", session.user.id).maybeSingle(),
      fallbackTimeout
    ]).then(({ data: profile, error }) => {
      if (error) console.warn("Auto-redirect lookup failed:", error);
      setLocation(profile ? `/player/${profile.id}` : "/profile/setup");
    }).catch(() => {
      setLocation("/profile/setup");
    });
  }, [authLoading, session, setLocation]);

  async function afterAuth(session: any) {
    const fallbackTimeout = new Promise<{data: null, error: Error}>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error("Profile lookup timed out") }), 8000)
    );

    try {
      const { data: profile, error } = await Promise.race([
        supabase.from("players").select("id").eq("user_id", session.user.id).maybeSingle(),
        fallbackTimeout
      ]);
      
      if (error) console.warn("afterAuth profile lookup failed:", error);
      setLocation(profile ? `/player/${profile.id}` : "/profile/setup");
    } catch (err) {
      console.error("Unexpected error in afterAuth:", err);
      setLocation("/profile/setup");
    }
  }

  /* ── Sign In ────────────────────────────────────────────── */
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg(""); setInfoMsg("");

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out. Check your connection and try again.")), 15000)
    );

    try {
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout,
      ]) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
      if (error) throw error;
      if (data.session) {
        await afterAuth(data.session);
      } else {
        setErrorMsg("Sign in failed — no session returned. Please try again.");
      }
    } catch (err: any) {
      const msg: string = err?.message ?? "An unexpected error occurred.";
      if (msg === "Email not confirmed") {
        setErrorMsg("Email not confirmed");
      } else if (msg.toLowerCase().includes("invalid")) {
        setErrorMsg("Incorrect email or password.");
      } else {
        setErrorMsg(msg);
      }
    } finally { setLoading(false); }
  };

  const handleResendLink = async () => {
    setLoading(true); setErrorMsg(""); setInfoMsg("");
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setInfoMsg("A new verification link has been sent to your email!");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally { setLoading(false); }
  };

  /* ── Sign Up ────────────────────────────────────────────── */
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) { setErrorMsg(err); return; }
    if (password.length < 8) { setErrorMsg("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErrorMsg("Passwords do not match."); return; }
    setLoading(true); setErrorMsg("");
    try {
      // 1. Check if email exists in auth.users (covers unverified users in limbo)
      const { data: emailExists, error: rpcError } = await supabase.rpc('check_email_exists', { lookup_email: email });

      if (emailExists) {
        setErrorMsg("You already have an account! Please go to Sign In (if you haven't verified yet, log in to resend the link).");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });

      // Fallback Supabase enumeration protection check (for auth accounts without a profile yet)
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        setErrorMsg("This email is already registered. Please Sign In, or use 'Forgot password? OTP' if you forgot your password.");
        return;
      }

      if (error) throw error;

      if (data.session) {
        await afterAuth(data.session);
      } else {
        setInfoMsg("Verification link sent! Please check your email (and spam folder) to confirm, then sign in.");
        setMode("signin");
      }
    } catch (err: any) {
      if (err.message.includes("already registered") || err.message.includes("already exists")) {
        setErrorMsg("This email is already registered. Please Sign In, or use 'Forgot password? OTP' if you forgot your password.");
      } else {
        setErrorMsg(err.message);
      }
    } finally { setLoading(false); }
  };

  /* ── OTP Send ───────────────────────────────────────────── */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) { setErrorMsg(err); return; }
    setLoading(true); setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      setMode("otp-verify");
      setInfoMsg(`Login code sent to ${email}`);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      setErrorMsg(msg.includes("not found") ? "No account found with this email. Please sign up first." : (msg || "An error occurred. Please try again."));
    } finally { setLoading(false); }
  };

  /* ── OTP Verify ─────────────────────────────────────────── */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
      if (error) throw error;
      if (data.session) await afterAuth(data.session);
    } catch (err: any) {
      setErrorMsg("Invalid or expired code. Please try again.");
    } finally { setLoading(false); }
  };

  /* ── Shared field styles ────────────────────────────────── */
  const input = "block w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">IISc Badminton Club</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Member portal · Campus Badminton Community</p>
        </div>

        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-xl shadow-slate-200/50 dark:shadow-none sm:rounded-3xl sm:px-10 border border-slate-100 dark:border-slate-800">

          {/* Inactivity logout notice */}
          {inactivityLogout && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded-xl text-amber-800 dark:text-amber-300 text-sm font-medium">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Your session expired due to inactivity. Please sign in again.</span>
              <button onClick={() => setInactivityLogout(false)} className="ml-auto text-amber-400 hover:text-amber-600 text-lg leading-none">×</button>
            </div>
          )}

          {/* Mode tabs (only for signin/signup) */}
          {(mode === "signin" || mode === "signup") && (
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
              <button
                onClick={() => { setMode("signin"); reset(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-all ${mode === "signin" ? "bg-emerald-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              >
                <LogIn className="w-4 h-4" /> Sign In
              </button>
              <button
                onClick={() => { setMode("signup"); reset(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-all ${mode === "signup" ? "bg-emerald-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              >
                <UserPlus className="w-4 h-4" /> Create Account
              </button>
            </div>
          )}

          {/* Info / Error messages */}
          {infoMsg && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
              {infoMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <AnimatePresence mode="wait">

            {/* ── WELCOME ── */}
            {mode === "welcome" && (
              <motion.div key="welcome" className="space-y-4 py-2"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                <div className="text-center space-y-1 pb-2">
                  <p className="text-base font-bold text-slate-700 dark:text-slate-200">Your campus shuttlers hub</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Track matches · Climb the ladder · Connect with players</p>
                </div>
                <button
                  onClick={() => { reset(); setMode("signin"); }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition"
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
                <button
                  onClick={() => { reset(); setMode("signup"); }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition"
                >
                  <UserPlus className="w-4 h-4" /> Create Account
                </button>
                <div className="pt-1 text-center">
                  <button
                    onClick={() => { sessionStorage.setItem("guest_mode", "1"); setLocation("/"); }}
                    className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold transition"
                  >
                    Continue as Guest →
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── SIGN IN ── */}
            {mode === "signin" && (
              <motion.form key="signin" onSubmit={handleSignIn} className="space-y-5"
                initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }} transition={{ duration: 0.2 }}>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com" className={`${input} pl-10`} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Your password" className={`${input} pl-10 pr-10`} />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base flex items-center justify-center gap-2">
                  {loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><LogIn className="w-5 h-5" /> Sign In</>}
                </Button>

                {errorMsg === "Email not confirmed" && (
                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl text-center">
                    <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-3">You haven't verified your email yet.</p>
                    <Button 
                      onClick={handleResendLink} 
                      disabled={loading}
                      variant="outline" 
                      type="button"
                      className="w-full border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                    >
                      Resend Verification Link
                    </Button>
                  </div>
                )}

                <div className="text-center pt-1 flex items-center justify-between">
                  <button type="button" onClick={() => { setMode("welcome"); reset(); }}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition font-semibold">
                    ← Back
                  </button>
                  <button type="button" onClick={() => { setMode("otp-email"); reset(); }}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition font-semibold">
                    Forgot password? OTP →
                  </button>
                </div>
              </motion.form>
            )}

            {/* ── SIGN UP ── */}
            {mode === "signup" && (
              <motion.form key="signup" onSubmit={handleSignUp} className="space-y-5"
                initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }}>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com" className={`${input} pl-10`} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters" className={`${input} pl-10 pr-10`} />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type={showPwd ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat password" className={`${input} pl-10`} />
                  </div>
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base flex items-center justify-center gap-2">
                  {loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><UserPlus className="w-5 h-5" /> Create Account</>}
                </Button>
                <div className="text-center">
                  <button type="button" onClick={() => { setMode("welcome"); reset(); }}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition font-semibold">
                    ← Back
                  </button>
                </div>
              </motion.form>
            )}

            {/* ── OTP EMAIL ── */}
            {mode === "otp-email" && (
              <motion.form key="otp-email" onSubmit={handleSendOtp} className="space-y-5"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                <div className="text-center mb-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sign in with a one-time code</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">We'll email you a login code — no password needed.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com" className={`${input} pl-10`} />
                  </div>
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base flex items-center justify-center gap-2">
                  {loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <>Send Login Code <ArrowRight className="w-5 h-5" /></>}
                </Button>
                <div className="text-center">
                  <button type="button" onClick={() => { setMode("signin"); reset(); }}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition font-semibold">
                    ← Back to Sign In
                  </button>
                </div>
              </motion.form>
            )}

            {/* ── OTP VERIFY ── */}
            {mode === "otp-verify" && (
              <motion.form key="otp-verify" onSubmit={handleVerifyOtp} className="space-y-5"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enter the code from your email</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">Sent to <strong>{email}</strong></p>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input required type="text" maxLength={8} value={otp} onChange={e => setOtp(e.target.value)}
                    placeholder="Enter code" autoComplete="one-time-code"
                    className={`${input} pl-10 text-center tracking-[0.4em] text-xl font-bold`} />
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base flex items-center justify-center gap-2">
                  {loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Verify & Log In"}
                </Button>
                <div className="text-center">
                  <button type="button" onClick={() => { setMode("otp-email"); reset(); }}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition font-semibold">
                    ← Change email / resend code
                  </button>
                </div>
              </motion.form>
            )}

          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
