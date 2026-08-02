import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Trophy, Swords, Flame, Star, CheckCircle, Smartphone } from "lucide-react";
import { Capacitor } from "@capacitor/core";

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
    title: "Your ELO Rating",
    body: "Every player starts at 1200 ELO. Win matches to gain points — especially against higher-ranked players. Lose and you'll drop, but never give up!",
    cta: null,
    accent: "from-blue-500 to-indigo-500",
    icon: <Trophy className="w-12 h-12 text-blue-400 opacity-80" />,
    detail: (
      <div className="bg-slate-800/60 rounded-xl p-3 text-xs font-mono text-slate-300 text-center mt-3">
        Expected = 1 / (1 + 10^((Opp ELO − Your ELO) / 400))
      </div>
    ),
  },
  {
    emoji: null,
    title: "Climb the Tiers",
    body: "As your ELO grows, you'll earn tier badges — from Bronze all the way to Grandmaster. Check your profile to see how close you are to the next tier!",
    cta: null,
    accent: "from-amber-500 to-orange-500",
    icon: <Star className="w-12 h-12 text-amber-400 opacity-80" />,
    detail: (
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-center">
        {[
          { name: "Bronze", elo: "0+", color: "text-orange-400" },
          { name: "Silver", elo: "1000+", color: "text-slate-300" },
          { name: "Gold", elo: "1200+", color: "text-yellow-400" },
          { name: "Platinum", elo: "1400+", color: "text-cyan-300" },
          { name: "Diamond", elo: "1600+", color: "text-blue-400" },
          { name: "Grandmaster", elo: "1800+", color: "text-rose-400" },
        ].map((t) => (
          <div key={t.name} className={`font-bold ${t.color}`}>
            <div>{t.name}</div>
            <div className="text-[10px] text-muted-foreground font-normal">{t.elo}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    emoji: null,
    title: "Log a Match",
    body: "After playing, one player submits the result. The opponent then confirms it — only then does ELO update. This two-step system prevents fraud.",
    cta: null,
    accent: "from-violet-500 to-purple-500",
    icon: <Swords className="w-12 h-12 text-violet-400 opacity-80" />,
    detail: (
      <div className="flex items-center justify-center gap-3 mt-3 text-xs text-muted-foreground">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center font-black mx-auto mb-1">1</div>
          Submit
        </div>
        <ChevronRight className="w-4 h-4 shrink-0" />
        <div className="text-center">
          <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center font-black mx-auto mb-1">2</div>
          Opponent Confirms
        </div>
        <ChevronRight className="w-4 h-4 shrink-0" />
        <div className="text-center">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary/70 flex items-center justify-center font-black mx-auto mb-1">✓</div>
          ELO Updates
        </div>
      </div>
    ),
  },
  {
    emoji: null,
    title: "Ironman Endurance",
    body: "The Ironman leaderboard ranks you by total matches played — regardless of wins. Play the most matches in a month and earn the exclusive Ironman badge!",
    cta: null,
    accent: "from-rose-500 to-orange-500",
    icon: <Flame className="w-12 h-12 text-rose-400 opacity-80" />,
  },
  {
    emoji: "🎉",
    title: "You're all set!",
    body: "Head to the Leaderboard to see where you stand, log your first match, and start climbing the ranks. Good luck on court!",
    cta: "Go to Leaderboard",
    ctaHref: "/",
    accent: "from-primary to-cyan-500",
    icon: <CheckCircle className="w-12 h-12 text-primary opacity-80" />,
  },
];

const getSteps = () => {
  const steps = [...STEPS];
  // Insert the Android Beta Testing slide right after the Welcome slide if they are on the web
  if (!Capacitor.isNativePlatform()) {
    steps.splice(1, 0, {
      emoji: null,
      title: "Help test our Android App!",
      body: "We are launching our new app on the Play Store, but we need 20 active testers for 14 days before we can publish it. If you have an Android phone, you can help us out!",
      cta: null,
      accent: "from-violet-500 to-amber-500",
      icon: <Smartphone className="w-12 h-12 text-amber-400 opacity-90" />,
      detail: (
        <div className="flex flex-col gap-2 mt-4 text-xs font-semibold">
          <a href="https://groups.google.com/g/iisc-badminton-app-testers/about" target="_blank" rel="noreferrer" className="bg-violet-500/20 text-violet-300 py-2 px-3 rounded-lg flex items-center justify-center gap-2 border border-violet-500/30 hover:bg-violet-500/30 transition-colors">
            <span className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-slate-900 font-black">1</span> Join Testing Group
          </a>
          <a href="https://play.google.com/apps/testing/shuttlers.iisc.com" target="_blank" rel="noreferrer" className="bg-slate-800 text-white py-2 px-3 rounded-lg flex items-center justify-center gap-2 border border-slate-700 hover:bg-slate-700 transition-colors">
            <span className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-white font-black">2</span> Download on Play Store
          </a>
        </div>
      ),
    });
  }
  return steps;
};

interface OnboardingTourProps {
  onComplete?: () => void;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
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
          className="relative w-full max-w-sm bg-[#0f172a] rounded-3xl shadow-2xl overflow-hidden border border-white/10"
        >
          {/* Gradient header accent */}
          <div className={`h-1.5 w-full bg-gradient-to-r ${s.accent}`} />

          {/* Dismiss */}
          <button
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
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r ${s.accent} text-foreground font-black text-sm shadow-lg transition hover:opacity-90`}
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
