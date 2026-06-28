import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, LogIn, UserPlus, Clock } from "lucide-react";
import { useJoinAuth } from "@/hooks/useJoinAuth";
import { WelcomeView, SignInView, SignUpView, OtpEmailView, OtpVerifyView } from "@/components/auth/JoinViews";
import { InfoModal } from "@/components/InfoModal";

export default function Join() {
  const auth = useJoinAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 hero-pattern opacity-50" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      {/* Subtle court lines */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="none">
          <line x1="400" y1="0" x2="400" y2="600" stroke="white" strokeWidth="1.5" />
          <line x1="0" y1="300" x2="800" y2="300" stroke="white" strokeWidth="1.5" />
          <ellipse cx="400" cy="300" rx="120" ry="90" stroke="white" strokeWidth="1.5" fill="none" />
          <rect x="120" y="100" width="560" height="400" stroke="white" strokeWidth="2" fill="none" />
        </svg>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg backdrop-blur-sm">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-black text-white tracking-tight" style={{ fontFamily: "Playfair Display, serif" }}>IISc Badminton Club</h1>
            <InfoModal
              title="MEMBER PORTAL"
              items={[
                { badge: "ACCESS", title: "Club Members Only", desc: "You must be an approved club member to access the internal platform." },
                { badge: "GUESTS", title: "Guest Access", desc: "If you are a guest, you don't need an account. Your host will log matches on your behalf." }
              ]}
              triggerClassName="text-white hover:text-emerald-300"
            />
          </div>
          <p className="mt-2 text-sm text-blue-300">Member portal · Campus Badminton Community</p>
        </div>

        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-2xl sm:rounded-3xl sm:px-10 border border-white/10 backdrop-blur-sm">
          {/* Inactivity logout notice */}
          {auth.inactivityLogout && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded-xl text-amber-800 dark:text-amber-300 text-sm font-medium">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Your session expired due to inactivity. Please sign in again.</span>
              <button onClick={() => auth.setInactivityLogout(false)} className="ml-auto text-amber-400 hover:text-amber-600 text-lg leading-none">×</button>
            </div>
          )}

          {/* Mode tabs (only for signin/signup) */}
          {(auth.mode === "signin" || auth.mode === "signup") && (
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
              <button onClick={() => { auth.setMode("signin"); auth.reset(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-all ${auth.mode === "signin" ? "bg-emerald-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                <LogIn className="w-4 h-4" /> Sign In
              </button>
              <button onClick={() => { auth.setMode("signup"); auth.reset(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-all ${auth.mode === "signup" ? "bg-emerald-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                <UserPlus className="w-4 h-4" /> Create Account
              </button>
            </div>
          )}

          {/* Info / Error messages */}
          {auth.infoMsg && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-medium">{auth.infoMsg}</div>}
          {auth.errorMsg && <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium">{auth.errorMsg}</div>}

          <AnimatePresence mode="wait">
            {auth.mode === "welcome" && <WelcomeView auth={auth} />}
            {auth.mode === "signin" && <SignInView auth={auth} />}
            {auth.mode === "signup" && <SignUpView auth={auth} />}
            {auth.mode === "otp-email" && <OtpEmailView auth={auth} />}
            {auth.mode === "otp-verify" && <OtpVerifyView auth={auth} />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
