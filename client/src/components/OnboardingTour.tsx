import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Trophy, Activity, Flame, CheckCircle, Smartphone } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useLocation } from "wouter";

const STORAGE_KEY = "onboarding_completed_v1";

const STEPS = [
  {
    emoji: "🏸",
    title: "Welcome to IISc Badminton Club!",
    body: "Your one-stop hub for badminton at IISc. Track matches, compete on leaderboards, and rise through the ranks.",
    cta: null,
    accent: "from-primary to-teal-500",
    icon: null,
  },
  {
    emoji: null,
    title: "The Pulse",
    body: "Stay up to date with the latest from the club! View the social feed, check out live updates, and see what others are up to.",
    cta: null,
    accent: "from-blue-500 to-indigo-500",
    icon: <Activity className="w-12 h-12 text-blue-400 opacity-80" />,
  },
  {
    emoji: null,
    title: "Tournaments & Live Scores",
    body: "Track ongoing tournaments in real-time. View live scores from active matches and follow tournament brackets directly from your phone.",
    cta: null,
    accent: "from-amber-500 to-orange-500",
    icon: <Trophy className="w-12 h-12 text-amber-400 opacity-80" />,
  },
  {
    emoji: null,
    title: "The Hub",
    body: "The central place for all club utilities. Did you lose a racket? Want to buy or sell gear? The Hub's Lost & Found and Exchange got you covered.",
    cta: null,
    accent: "from-violet-500 to-purple-500",
    icon: <CheckCircle className="w-12 h-12 text-violet-400 opacity-80" />,
  },
  {
    emoji: null,
    title: "Legacy & Hall of Fame",
    body: "View past champions, tournament archives, and our club's history. See who cemented their name in the IISc Badminton Hall of Fame!",
    cta: null,
    accent: "from-rose-500 to-orange-500",
    icon: <Flame className="w-12 h-12 text-rose-400 opacity-80" />,
  },
  {
    emoji: "🎉",
    title: "You're all set!",
    body: "Head to the Pulse to see what's happening right now, or explore Tournaments. See you on the courts!",
    cta: "Go to Pulse",
    ctaHref: "/pulse",
    accent: "from-primary to-cyan-500",
    icon: <CheckCircle className="w-12 h-12 text-primary opacity-80" />,
  },
];

const getSteps = () => {
  const steps = [...STEPS];
  // Insert the Android App slide right after the Welcome slide if they are on the web
  if (!Capacitor.isNativePlatform()) {
    steps.splice(1, 0, {
      emoji: null,
      title: "Download our Android App!",
      body: "Our official app is now live on the Play Store! Get real-time match tracking, dynamic ELO ratings, and community features right on your phone.",
      cta: null,
      accent: "from-violet-500 to-amber-500",
      icon: <Smartphone className="w-12 h-12 text-amber-400 opacity-90" />,
      detail: (
        <div className="flex flex-col gap-2 mt-4 text-xs font-semibold">
          <a href="https://play.google.com/store/apps/details?id=shuttlers.iisc.com" target="_blank" rel="noreferrer" className="bg-slate-800 text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-slate-700 hover:bg-slate-700 transition-colors">
            Download on Play Store
          </a>
        </div>
      ),
    } as any);
  }
  return steps;
};

interface OnboardingTourProps {
  onComplete?: () => void;
}

/**
 * The tour introduces the whole app, so it opens only when a visit starts on
 * Home. Someone opening a shared match or tournament link goes straight to
 * that page; they get the tour on a later visit that starts on Home.
 */
export function isTourEntryPath(path: string): boolean {
  return path === "/" || path === "";
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    // Only the page the visit starts on counts, so this runs once on mount.
    if (!isTourEntryPath(location)) return;
    let done: string | null = null;
    try {
      done = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked: treat as seen rather than showing the tour every visit.
      done = "1";
    }
    if (!done) setVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage blocked: closing still works for this visit.
    }
    setVisible(false);
    onComplete?.();
  };

  const steps = getSteps();

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else dismiss();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible) return null;

  const s = steps[step];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={dismiss}
        />

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.96 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-sm bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10"
        >
          {/* Gradient header accent */}
          <div className={`h-1.5 w-full bg-gradient-to-r ${s.accent}`} />

          {/* Dismiss */}
          <button aria-label="Dismiss tour"
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-foreground/60 hover:text-foreground transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="px-7 pt-6 pb-7 text-center">
            {s.emoji && <div className="text-5xl mb-4">{s.emoji}</div>}
            {!s.emoji && s.icon && (
              <div className="flex justify-center mb-4">{s.icon}</div>
            )}

            <h2 className="text-xl font-black text-foreground mb-3">{s.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            {(s as any).detail && (s as any).detail}
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 pb-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? `w-6 bg-gradient-to-r ${s.accent}`
                    : "w-1.5 bg-slate-700"
                }`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between px-7 py-5 border-t border-white/8">
            <button
              onClick={prev}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition font-semibold"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <button
              onClick={next}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-lg transition hover:opacity-90`}
            >
              {step === STEPS.length - 1 ? "Let's Go! 🏸" : "Next"}
              {step < STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/** Utility: reset tour (for testing) */
export function resetOnboardingTour() {
  localStorage.removeItem(STORAGE_KEY);
}
