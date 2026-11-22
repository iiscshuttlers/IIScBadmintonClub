import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Trophy, Users, Globe, CheckCircle, Smartphone } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useLocation } from "wouter";

const STORAGE_KEY = "onboarding_completed_v1";

const STEPS = [
  {
    emoji: "🏸",
    title: "Welcome to IISc Badminton Club!",
    body: "Your one-stop hub for badminton at IISc. Track matches, compete on leaderboards, and rise through the ranks.",
    cta: null,
    accent: "from-primary to-team",
    icon: null,
  },
  {
    emoji: null,
    title: "Tournaments & Live Scores",
    body: "Every club tournament in one place: register, follow the draw and the schedule, and watch live scores from the courts. When a match is on, the Tournaments tab shows LIVE.",
    cta: null,
    accent: "from-warning to-secondary",
    icon: <Trophy className="w-12 h-12 text-gold opacity-80" />,
  },
  {
    emoji: null,
    title: "Players",
    body: "Find members in the directory and see who's on top of the Elo rankings. Champions and Records show who cemented their name in club history.",
    cta: null,
    accent: "from-info to-info",
    icon: <Users className="w-12 h-12 text-info opacity-80" />,
  },
  {
    emoji: null,
    title: "The Club",
    body: "News and polls, the court calendar, our photo and video gallery, courts, the market (Lost & Found, Buy & Sell), and who we are.",
    cta: null,
    accent: "from-individual to-individual",
    icon: <Globe className="w-12 h-12 text-individual opacity-80" />,
  },
  {
    emoji: "🎉",
    title: "You're all set!",
    body: "Check Home for what's on right now, or jump into Tournaments. See you on the courts!",
    cta: "Go to Tournaments",
    ctaHref: "/tournaments",
    accent: "from-primary to-accent",
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
      accent: "from-individual to-warning",
      icon: <Smartphone className="w-12 h-12 text-warning opacity-90" />,
      detail: (
        <div className="flex flex-col gap-2 mt-4 text-xs font-semibold">
          <a href="https://play.google.com/store/apps/details?id=shuttlers.iisc.com" target="_blank" rel="noreferrer" className="bg-muted text-foreground py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-border-strong hover:bg-muted-strong transition-colors">
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
          className="absolute inset-0 bg-media/70 backdrop-blur-sm"
          onClick={dismiss}
        />

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.96 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl overflow-hidden border border-foreground/10"
        >
          {/* Gradient header accent */}
          <div className={`h-1.5 w-full bg-gradient-to-r ${s.accent}`} />

          {/* Dismiss */}
          <button aria-label="Dismiss tour"
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-foreground/60 hover:text-foreground transition"
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
                    : "w-1.5 bg-muted-strong"
                }`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between px-7 py-5 border-t border-foreground/8">
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
