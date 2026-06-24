import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, UserPlus, LogIn, ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPasswordStrength, type useJoinAuth } from "@/hooks/useJoinAuth";

const inputClass = "block w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm";

type JoinAuthContext = ReturnType<typeof useJoinAuth>;

export function WelcomeView({ auth }: { auth: JoinAuthContext }) {
  const [, setLocation] = useLocation();
  return (
    <motion.div
      key="welcome"
      className="space-y-4 py-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="text-center space-y-1 pb-2">
        <p className="text-base font-bold text-slate-700 dark:text-slate-200">Your campus shuttlers hub</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Track matches · Climb the ladder · Connect with players</p>
      </div>
      <button onClick={() => { auth.reset(); auth.setMode("signin"); }} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition">
        <LogIn className="w-4 h-4" /> Sign In
      </button>
      <button onClick={() => { auth.reset(); auth.setMode("signup"); }} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition">
        <UserPlus className="w-4 h-4" /> Create Account
      </button>
      <div className="pt-1 text-center">
        <button onClick={() => { sessionStorage.setItem("guest_mode", "1"); setLocation("/"); }} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold transition">
          Continue as Guest →
        </button>
      </div>
    </motion.div>
  );
}

export function SignInView({ auth }: { auth: JoinAuthContext }) {
  return (
    <motion.form key="signin" onSubmit={auth.handleSignIn} className="space-y-5" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }} transition={{ duration: 0.2 }}>
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input required type="email" value={auth.email} onChange={e => auth.setEmail(e.target.value)} placeholder="your@email.com" className={`${inputClass} pl-10`} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input required type={auth.showPwd ? "text" : "password"} value={auth.password} onChange={e => auth.setPassword(e.target.value)} placeholder="Your password" className={`${inputClass} pl-10 pr-10`} />
          <button type="button" onClick={() => auth.setShowPwd(!auth.showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {auth.showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" disabled={auth.loading} className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base flex items-center justify-center gap-2">
        {auth.loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><LogIn className="w-5 h-5" /> Sign In</>}
      </Button>
      {auth.errorMsg === "Email not confirmed" && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl text-center">
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-3">You haven't verified your email yet.</p>
          <Button onClick={auth.handleResendLink} disabled={auth.loading} variant="outline" type="button" className="w-full border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800">Resend Verification Link</Button>
        </div>
      )}
      <div className="text-center pt-1 flex items-center justify-between">
        <button type="button" onClick={() => { auth.setMode("welcome"); auth.reset(); }} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition font-semibold">← Back</button>
        <button type="button" onClick={() => { auth.setMode("otp-email"); auth.reset(); }} className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition font-semibold">Forgot password? OTP →</button>
      </div>
    </motion.form>
  );
}

export function SignUpView({ auth }: { auth: JoinAuthContext }) {
  return (
    <motion.form key="signup" onSubmit={auth.handleSignUp} className="space-y-5" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }}>
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input required type="email" value={auth.email} onChange={e => auth.setEmail(e.target.value)} placeholder="your@email.com" className={`${inputClass} pl-10`} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input required type={auth.showPwd ? "text" : "password"} value={auth.password} onChange={e => auth.setPassword(e.target.value)} placeholder="Min. 8 characters" className={`${inputClass} pl-10 pr-10`} />
          <button type="button" onClick={() => auth.setShowPwd(!auth.showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {auth.showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {auth.password && (
          <div className="mt-2.5">
            <div className="flex gap-1.5 mb-1.5">
              {[1, 2, 3, 4].map(level => {
                const strength = getPasswordStrength(auth.password);
                let color = "bg-slate-200 dark:bg-slate-700";
                if (level <= strength) {
                  if (strength <= 1) color = "bg-rose-500";
                  else if (strength === 2) color = "bg-orange-500";
                  else if (strength === 3) color = "bg-amber-500";
                  else color = "bg-emerald-500";
                }
                return <div key={level} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${color}`} />;
              })}
            </div>
            <p className="text-right text-[10px] font-bold uppercase tracking-wider">
              {(() => {
                const s = getPasswordStrength(auth.password);
                if (s <= 1) return <span className="text-rose-500">Weak</span>;
                if (s === 2) return <span className="text-orange-500">Fair</span>;
                if (s === 3) return <span className="text-amber-500">Good</span>;
                return <span className="text-emerald-500">Strong</span>;
              })()}
            </p>
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input required type={auth.showPwd ? "text" : "password"} value={auth.confirm} onChange={e => auth.setConfirm(e.target.value)} placeholder="Repeat password" className={`${inputClass} pl-10`} />
        </div>
      </div>
      <label className="flex items-start gap-3 cursor-pointer group">
        <input type="checkbox" checked={auth.agreedToTerms} onChange={e => auth.setAgreedToTerms(e.target.checked)} className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 shrink-0" />
        <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          I agree to the <Link href="/privacy"><span className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">Privacy Policy</span></Link> and <Link href="/terms"><span className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">Terms of Service</span></Link>.
        </span>
      </label>
      <Button type="submit" disabled={auth.loading || !auth.agreedToTerms} className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base flex items-center justify-center gap-2 disabled:opacity-50">
        {auth.loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><UserPlus className="w-5 h-5" /> Create Account</>}
      </Button>
      <div className="text-center">
        <button type="button" onClick={() => { auth.setMode("welcome"); auth.reset(); }} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition font-semibold">← Back</button>
      </div>
    </motion.form>
  );
}

export function OtpEmailView({ auth }: { auth: JoinAuthContext }) {
  return (
    <motion.form key="otp-email" onSubmit={auth.handleSendOtp} className="space-y-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
      <div className="text-center mb-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sign in with a one-time code</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">We'll email you a login code — no password needed.</p>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input required type="email" value={auth.email} onChange={e => auth.setEmail(e.target.value)} placeholder="your@email.com" className={`${inputClass} pl-10`} />
        </div>
      </div>
      <Button type="submit" disabled={auth.loading} className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base flex items-center justify-center gap-2">
        {auth.loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <>Send Login Code <ArrowRight className="w-5 h-5" /></>}
      </Button>
      <div className="text-center">
        <button type="button" onClick={() => { auth.setMode("signin"); auth.reset(); }} className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition font-semibold">← Back to Sign In</button>
      </div>
    </motion.form>
  );
}

export function OtpVerifyView({ auth }: { auth: JoinAuthContext }) {
  return (
    <motion.form key="otp-verify" onSubmit={auth.handleVerifyOtp} className="space-y-5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enter the code from your email</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">Sent to <strong>{auth.email}</strong></p>
      </div>
      <div className="relative">
        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input required type="text" maxLength={8} value={auth.otp} onChange={e => auth.setOtp(e.target.value)} placeholder="Enter code" autoComplete="one-time-code" className={`${inputClass} pl-10 text-center tracking-[0.4em] text-xl font-bold`} />
      </div>
      <Button type="submit" disabled={auth.loading} className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base flex items-center justify-center gap-2">
        {auth.loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Verify & Log In"}
      </Button>
      <div className="text-center">
        <button type="button" onClick={() => { auth.setMode("otp-email"); auth.reset(); }} className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition font-semibold">← Change email / resend code</button>
      </div>
    </motion.form>
  );
}
