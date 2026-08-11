import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, UserPlus, LogIn, ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPasswordStrength, type useJoinAuth } from "@/hooks/useJoinAuth";

const inputClass = "block w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm";

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
        <p className="text-base font-bold text-muted-foreground dark:text-slate-200">Your campus shuttlers hub</p>
        <p className="text-xs text-muted-foreground dark:text-muted-foreground">Track matches · Climb the ladder · Connect with players</p>
      </div>
      <button onClick={() => { auth.reset(); auth.setMode("signin"); }} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 transition">
        <LogIn className="w-4 h-4" /> Sign In
      </button>
      <button onClick={() => { auth.reset(); auth.setMode("signup"); }} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-slate-200 font-bold text-sm hover:border-primary hover:text-primary dark:hover:text-primary transition">
        <UserPlus className="w-4 h-4" /> Create Account
      </button>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white dark:bg-slate-900 px-2 text-muted-foreground">Or</span>
        </div>
      </div>
      <button onClick={auth.handleGoogleSignIn} disabled={auth.loading} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition">
        {auth.loading ? <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" /> : (
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Continue with Google
      </button>
      <div className="pt-1 text-center">
        <button onClick={() => { sessionStorage.setItem("guest_mode", "1"); setLocation("/"); }} className="text-sm text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300 font-semibold transition">
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
        <label className="block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input required type="email" value={auth.email} onChange={e => auth.setEmail(e.target.value)} placeholder="your@email.com" className={`${inputClass} pl-10`} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input required type={auth.showPwd ? "text" : "password"} value={auth.password} onChange={e => auth.setPassword(e.target.value)} placeholder="Your password" className={`${inputClass} pl-10 pr-10`} />
          <button type="button" onClick={() => auth.setShowPwd(!auth.showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
            {auth.showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" disabled={auth.loading} className="w-full py-6 bg-primary hover:bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 transition-all text-base flex items-center justify-center gap-2">
        {auth.loading ? <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black/80 animate-spin" /> : <><LogIn className="w-5 h-5" /> Sign In</>}
      </Button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white dark:bg-slate-900 px-2 text-muted-foreground">Or</span>
        </div>
      </div>
      <button type="button" onClick={auth.handleGoogleSignIn} disabled={auth.loading} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition">
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Sign in with Google
      </button>
      {auth.errorMsg === "Email not confirmed" && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl text-center">
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-3">You haven't verified your email yet.</p>
          <Button onClick={auth.handleResendLink} disabled={auth.loading} variant="outline" type="button" className="w-full border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800">Resend Verification Link</Button>
        </div>
      )}
      <div className="text-center pt-1 flex items-center justify-between">
        <button type="button" onClick={() => { auth.setMode("welcome"); auth.reset(); }} className="text-xs text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300 transition font-semibold">← Back</button>
        <button type="button" onClick={() => { auth.setMode("otp-email"); auth.reset(); }} className="text-xs text-muted-foreground dark:text-muted-foreground hover:text-primary dark:hover:text-primary transition font-semibold">Forgot password? OTP →</button>
      </div>
    </motion.form>
  );
}

export function SignUpView({ auth }: { auth: JoinAuthContext }) {
  return (
    <motion.form key="signup" onSubmit={auth.handleSignUp} className="space-y-5" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }}>
      <div>
        <label className="block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input required type="email" value={auth.email} onChange={e => auth.setEmail(e.target.value)} placeholder="your@email.com" className={`${inputClass} pl-10`} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input required type={auth.showPwd ? "text" : "password"} value={auth.password} onChange={e => auth.setPassword(e.target.value)} placeholder="Min. 8 characters" className={`${inputClass} pl-10 pr-10`} />
          <button type="button" onClick={() => auth.setShowPwd(!auth.showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
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
                  else color = "bg-primary";
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
                return <span className="text-primary">Strong</span>;
              })()}
            </p>
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input required type={auth.showPwd ? "text" : "password"} value={auth.confirm} onChange={e => auth.setConfirm(e.target.value)} placeholder="Repeat password" className={`${inputClass} pl-10`} />
        </div>
      </div>
      <label className="flex items-start gap-3 cursor-pointer group">
        <input type="checkbox" checked={auth.agreedToTerms} onChange={e => auth.setAgreedToTerms(e.target.checked)} className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary accent-primary shrink-0" />
        <span className="text-xs text-muted-foreground dark:text-muted-foreground leading-relaxed">
          I agree to the <Link href="/privacy"><span className="text-primary dark:text-primary font-bold hover:underline">Privacy Policy</span></Link> and <Link href="/terms"><span className="text-primary dark:text-primary font-bold hover:underline">Terms of Service</span></Link>.
        </span>
      </label>
      <Button type="submit" disabled={auth.loading || !auth.agreedToTerms} className="w-full py-6 bg-primary hover:bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 transition-all text-base flex items-center justify-center gap-2 disabled:opacity-50">
        {auth.loading ? <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black/80 animate-spin" /> : <><UserPlus className="w-5 h-5" /> Create Account</>}
      </Button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white dark:bg-slate-900 px-2 text-muted-foreground">Or</span>
        </div>
      </div>
      <button type="button" onClick={auth.handleGoogleSignIn} disabled={auth.loading} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition">
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Sign up with Google
      </button>
      <div className="text-center">
        <button type="button" onClick={() => { auth.setMode("welcome"); auth.reset(); }} className="text-xs text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300 transition font-semibold">← Back</button>
      </div>
    </motion.form>
  );
}

export function OtpEmailView({ auth }: { auth: JoinAuthContext }) {
  return (
    <motion.form key="otp-email" onSubmit={auth.handleSendOtp} className="space-y-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
      <div className="text-center mb-2">
        <p className="text-sm font-semibold text-muted-foreground dark:text-slate-300">Sign in with a one-time code</p>
        <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">We'll email you a login code — no password needed.</p>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input required type="email" value={auth.email} onChange={e => auth.setEmail(e.target.value)} placeholder="your@email.com" className={`${inputClass} pl-10`} />
        </div>
      </div>
      <Button type="submit" disabled={auth.loading} className="w-full py-6 bg-primary hover:bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 transition-all text-base flex items-center justify-center gap-2">
        {auth.loading ? <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black/80 animate-spin" /> : <>Send Login Code <ArrowRight className="w-5 h-5" /></>}
      </Button>
      <div className="text-center">
        <button type="button" onClick={() => { auth.setMode("signin"); auth.reset(); }} className="text-xs text-muted-foreground dark:text-muted-foreground hover:text-primary dark:hover:text-primary transition font-semibold">← Back to Sign In</button>
      </div>
    </motion.form>
  );
}

export function OtpVerifyView({ auth }: { auth: JoinAuthContext }) {
  return (
    <motion.form key="otp-verify" onSubmit={auth.handleVerifyOtp} className="space-y-5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
      <div className="text-center">
        <p className="text-sm font-semibold text-muted-foreground dark:text-slate-300">Enter the code from your email</p>
        <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1 break-all">Sent to <strong>{auth.email}</strong></p>
      </div>
      <div className="relative">
        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input required type="text" maxLength={8} value={auth.otp} onChange={e => auth.setOtp(e.target.value)} placeholder="Enter code" autoComplete="one-time-code" className={`${inputClass} pl-10 text-center tracking-[0.4em] text-xl font-bold`} />
      </div>
      <Button type="submit" disabled={auth.loading} className="w-full py-6 bg-primary hover:bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 transition-all text-base flex items-center justify-center gap-2">
        {auth.loading ? <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black/80 animate-spin" /> : "Verify & Log In"}
      </Button>
      <div className="text-center">
        <button type="button" onClick={() => { auth.setMode("otp-email"); auth.reset(); }} className="text-xs text-muted-foreground dark:text-muted-foreground hover:text-primary dark:hover:text-primary transition font-semibold">← Change email / resend code</button>
      </div>
    </motion.form>
  );
}
