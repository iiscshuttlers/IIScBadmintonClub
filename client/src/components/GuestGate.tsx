import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Lock, LogIn, UserPlus, Activity, Users, Swords, BarChart3, CalendarDays, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { currentReturnUrl } from "@/lib/returnUrl";
import { BackButton } from "@/components/ui/BackButton";

interface GuestGateProps {
  children: ReactNode;
  /** Display name for the feature being gated */
  feature: string;
  /** Brief description of what this feature offers */
  description?: string;
  /** Optional icon to show */
  icon?: LucideIcon;
}

const FEATURE_META: Record<string, { description: string; icon: LucideIcon }> = {
  News: {
    description: "Club announcements, tournament updates and results as they are posted.",
    icon: Activity,
  },
  Calendar: {
    description: "Court bookings, club sessions and tournament schedules in one calendar.",
    icon: CalendarDays,
  },
  "Player Profile": {
    description: "Detailed player stats, match history, Elo rating progression, and head-to-head records.",
    icon: BarChart3,
  },
  "Compare Players": {
    description: "Side-by-side comparison of two players' stats, win rates, and head-to-head records.",
    icon: Swords,
  },
  "Doubles Pair": {
    description: "Partnership stats, match history, and performance analytics for doubles pairs.",
    icon: Users,
  },
};

export function GuestGate({ children, feature, description, icon }: GuestGateProps) {
  const { session, isInitializing } = useAuth();

  if (isInitializing) {
    return <PageSkeleton />;
  }

  // User is signed in — render the page normally
  if (session) {
    return <>{children}</>;
  }

  // Guest user — show the sign-in prompt
  const meta = FEATURE_META[feature];
  const Icon = icon || meta?.icon || Lock;
  const desc = description || meta?.description || "This feature is available to club members.";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="relative bg-card rounded-3xl border border-border shadow-2xl shadow-media/30 overflow-hidden">
          {/* Gradient accent bar */}
          <div className="h-1 bg-gradient-to-r from-primary via-team to-success" />

          <div className="p-8 sm:p-10 text-center">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Icon className="w-8 h-8 text-primary" />
            </div>

            {/* Feature name */}
            <h2 className="text-2xl font-black text-foreground tracking-tight mb-2">
              {feature}
            </h2>

            {/* Members only badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 border border-warning/50 text-warning text-xs font-bold mb-4">
              <Lock className="w-3 h-3" />
              Members Only
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-xs mx-auto">
              {desc}
            </p>

            {/* Sign In button */}
            <Link href="/join" onClick={() => sessionStorage.setItem("return_url", currentReturnUrl())}>
              <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] cursor-pointer">
                <LogIn className="w-4 h-4" />
                Sign In to Access
              </button>
            </Link>

            {/* Create account link */}
            <Link href="/join" onClick={() => sessionStorage.setItem("return_url", currentReturnUrl())}>
              <button className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-muted hover:bg-muted-strong text-soft font-bold text-sm transition-colors cursor-pointer">
                <UserPlus className="w-4 h-4" />
                Create Account
              </button>
            </Link>

            {/* Back link */}
            <p className="mt-5 text-xs text-muted-foreground">
                <BackButton parent="/" className="hover:text-soft transition-colors font-semibold">
                  ← Back
                </BackButton>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
