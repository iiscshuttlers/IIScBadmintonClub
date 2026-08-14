import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeaserOverlayProps {
  isLocked: boolean;
  children: ReactNode;
  message?: string;
  ctaText?: string;
}

export function TeaserOverlay({ 
  isLocked, 
  children, 
  message = "Sign Up to unlock full player analytics & head-to-head stats",
  ctaText = "Create an Account"
}: TeaserOverlayProps) {
  const [location, setLocation] = useLocation();

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative w-full">
      {/* Container for children with a hard blur and unclickable */}
      <div className="pointer-events-none select-none blur-[6px] opacity-40 transition-all duration-500 overflow-hidden" aria-hidden="true">
        {children}
      </div>

      {/* Glassmorphism Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-white/30 dark:bg-slate-950/30 backdrop-blur-sm z-10 rounded-3xl">
        <div className="bg-white/80 dark:bg-slate-900/80 p-6 md:p-8 rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col items-center text-center max-w-sm w-full backdrop-blur-lg transform hover:scale-105 transition-transform duration-300">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5 text-primary shadow-inner border border-primary/20">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            Members Only
          </h3>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            {message}
          </p>
          <Button 
            onClick={() => {
              sessionStorage.setItem("return_url", location + window.location.search + window.location.hash);
              setLocation("/join");
            }}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/25 transition-all"
          >
            {ctaText}
          </Button>
          <button
            onClick={() => {
              sessionStorage.setItem("return_url", location + window.location.search + window.location.hash);
              setLocation("/join");
            }}
            className="mt-3 text-sm font-bold text-primary hover:text-primary/80 underline underline-offset-4 transition"
          >
            Already have an account? Sign In
          </button>
          <div className="mt-2 text-xs font-semibold text-muted-foreground/60">
            Takes less than 30 seconds!
          </div>
        </div>
      </div>
    </div>
  );
}
