import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, LogIn, UserPlus, Clock } from "lucide-react";
import { useJoinAuth } from "@/hooks/useJoinAuth";
import { WelcomeView, SignInView, SignUpView, OtpEmailView, OtpVerifyView } from "@/components/auth/JoinViews";
import { InfoModal } from "@/components/InfoModal";

export default function Join() {
  const auth = useJoinAuth();

  return (
    <div className="min-h-screen bg-gradient-to-tr from-team/20 via-success to-primary flex flex-col justify-center py-12 sm:px-6 lg:px-6 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 hero-pattern opacity-50" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-success/5 rounded-full blur-3xl pointer-events-none" />
      {/* Subtle court lines */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg className="w-full h-full text-on-accent" viewBox="0 0 800 600" preserveAspectRatio="none">
          <line x1="400" y1="0" x2="400" y2="600" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="300" x2="800" y2="300" stroke="currentColor" strokeWidth="1.5" />
          <ellipse cx="400" cy="300" rx="120" ry="90" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <rect x="120" y="100" width="560" height="400" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-on-accent/10 border border-on-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg backdrop-blur-sm">
            <ShieldCheck className="w-8 h-8 text-on-accent" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-black text-on-accent tracking-tight font-display">IISc Badminton Club</h1>
            <InfoModal
              title="MEMBER PORTAL"
              items={[
                { badge: "ACCESS", title: "Club Members Only", desc: "You must be an approved club member to access the internal platform." },
                { badge: "GUESTS", title: "Guest Access", desc: "If you are a guest, you don't need an account. Your host will log matches on your behalf." }
              ]}
              triggerClassName="text-on-accent hover:text-on-accent/70"
            />
          </div>
          <p className="mt-2 text-sm text-on-accent/80">Member portal · Campus Badminton Community</p>
        </div>

        <div className="bg-card py-8 px-6 shadow-2xl sm:rounded-3xl sm:px-10 border border-foreground/10 backdrop-blur-sm">
          {/* Contextual Reason Banner */}
          {(() => {
            const params = new URLSearchParams(window.location.search);
            const reason = params.get("reason");
            if (!reason) return null;
            return (
              <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-primary/20 border border-primary/30 rounded-2xl text-soft text-xs font-bold animate-in fade-in">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>{decodeURIComponent(reason)}</span>
              </div>
            );
          })()}

          {/* Inactivity logout notice */}
          {auth.inactivityLogout && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning rounded-xl text-warning text-sm font-medium">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Your session expired due to inactivity. Please sign in again.</span>
              <button onClick={() => auth.setInactivityLogout(false)} className="ml-auto text-warning hover:text-warning/80 text-lg leading-none">×</button>
            </div>
          )}

          {/* Mode tabs (only for signin/signup) */}
          {(auth.mode === "signin" || auth.mode === "signup") && (
            <div className="flex rounded-xl border border-border-strong overflow-hidden mb-6">
              <button onClick={() => { auth.setMode("signin", { replace: true }); auth.reset(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-all ${auth.mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <LogIn className="w-4 h-4" /> Sign In
              </button>
              <button onClick={() => { auth.setMode("signup", { replace: true }); auth.reset(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-all ${auth.mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <UserPlus className="w-4 h-4" /> Create Account
              </button>
            </div>
          )}

          {/* Info / Error messages */}
          {auth.infoMsg && <div className="mb-4 px-4 py-3 rounded-xl bg-primary/20 border border-primary/80 text-primary text-sm font-medium">{auth.infoMsg}</div>}
          {auth.errorMsg && <div className="mb-4 px-4 py-3 rounded-xl bg-danger/10 border border-danger/40 text-danger text-sm font-medium">{typeof auth.errorMsg === "string" ? auth.errorMsg : String(auth.errorMsg)}</div>}

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
