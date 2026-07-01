import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Sword, Sparkles, ChevronRight, UserCircle, PlusCircle, LogIn } from "lucide-react";
import type { Player } from "@/components/players-directory/PlayerCard";

interface AuthBannerProps {
  session: any;
  ownProfile: Player | null;
  authLoading: boolean;
  pendingMatches: any[];
  onConfirmMatch: (matchId: string) => void;
  onRejectMatch: (matchId: string) => void;
  processingMatches?: Set<string>;
}

export function AuthBanner({
  session,
  ownProfile,
  authLoading,
  pendingMatches,
  onConfirmMatch,
  onRejectMatch,
  processingMatches = new Set(),
}: AuthBannerProps) {
  const [, setLocation] = useLocation();

  if (authLoading) return null;

  /* Logged in + has a profile */
  if (session && ownProfile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 space-y-4"
      >
        {/* Pending Matches Alert */}
        {pendingMatches.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-3xl p-6 shadow-md mb-4">
            <h3 className="text-amber-800 dark:text-amber-400 font-black mb-4 flex items-center gap-2">
              <Sword className="w-5 h-5" /> Pending Match Verifications (
              {pendingMatches.length})
            </h3>
            <div className="space-y-3">
              {pendingMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/60 dark:bg-black/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30"
                >
                  <div className="text-sm font-semibold text-muted-foreground dark:text-slate-300">
                    {m.player1.full_name}{" "}
                    <span className="text-amber-600 dark:text-amber-500 font-black italic mx-2">
                      VS
                    </span>{" "}
                    {m.player2.full_name}
                    <div className="text-xs text-muted-foreground mt-1">
                      Score: <span className="font-bold">{m.score}</span> •
                      Winner:{" "}
                      <span className="font-bold text-primary">
                        {m.winner_id === m.player1_id
                          ? m.player1.full_name
                          : m.player2.full_name}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => onConfirmMatch(m.id)}
                      disabled={processingMatches.has(m.id)}
                      className={`flex-1 sm:flex-none px-4 py-2 text-foreground text-xs font-bold rounded-lg transition ${
                        processingMatches.has(m.id) ? "bg-primary cursor-not-allowed opacity-70" : "bg-primary hover:bg-primary"
                      }`}
                    >
                      {processingMatches.has(m.id) ? "Confirming..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => onRejectMatch(m.id)}
                      disabled={processingMatches.has(m.id)}
                      className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition ${
                        processingMatches.has(m.id)
                          ? "bg-slate-200 text-muted-foreground cursor-not-allowed dark:bg-slate-800/50 dark:text-muted-foreground"
                          : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-muted-foreground dark:text-slate-300"
                      }`}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xs uppercase tracking-widest font-black text-muted-foreground dark:text-muted-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Your Profile
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-primary/50 dark:border-primary shadow-xl shadow-primary/10/50 dark:shadow-none p-6 flex flex-col sm:flex-row items-center gap-6">
            <Link
              href={`/player/${ownProfile.id}`}
              className="flex items-center gap-4 flex-1 group min-w-0"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary shadow-md shrink-0">
                {ownProfile.avatar_url ? (
                  <img
                    loading="lazy"
                    src={ownProfile.avatar_url}
                    alt={ownProfile.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/15 dark:bg-primary/30 flex items-center justify-center text-2xl font-black text-primary">
                    {ownProfile.full_name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-foreground dark:text-foreground group-hover:text-primary dark:group-hover:text-primary transition-colors">
                  {ownProfile.full_name}
                  {ownProfile.nickname && (
                    <span className="ml-2 text-sm font-semibold text-muted-foreground italic whitespace-nowrap">
                      "{ownProfile.nickname}"
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground dark:text-muted-foreground font-medium mt-0.5">
                  {ownProfile.department} · Class of {ownProfile.joined_year}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-primary dark:text-primary text-xs font-bold">
                  View full profile <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  /* Logged in but NO profile yet */
  if (session && !ownProfile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-primary to-teal-700 rounded-3xl p-6 text-foreground shadow-xl shadow-primary/20">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <UserCircle className="w-9 h-9 text-foreground" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-black mb-1">
                You're in! Now create your player card 🏸
              </div>
              <div className="text-primary/30 text-sm font-medium">
                You're signed in as{" "}
                <span className="font-bold text-foreground">
                  {session.user.email}
                </span>{" "}
                but haven't set up your profile yet.
              </div>
            </div>
            <button
              onClick={() => setLocation("/profile/setup")}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-primary font-black text-sm hover:bg-primary/10 transition shadow-lg shrink-0"
            >
              <PlusCircle className="w-5 h-5" /> Create My Profile
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (session) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10"
    >
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 rounded-3xl p-6 text-foreground shadow-xl border border-slate-700/50">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <UserCircle className="w-9 h-9 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-black mb-1">
              Are you a member? Build your player card!
            </div>
            <div className="text-slate-300 text-sm font-medium">
              Sign in with your{" "}
              <span className="font-black text-primary">
                preferred personal Gmail account
              </span>{" "}
              to create and manage your profile.
            </div>
          </div>
          <button
            onClick={() => {
              sessionStorage.setItem("return_url", window.location.pathname + window.location.search + window.location.hash);
              setLocation("/join");
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary hover:bg-primary text-foreground font-black text-sm transition shadow-lg shadow-primary/20 shrink-0"
          >
            <LogIn className="w-5 h-5" /> Sign In / Join
          </button>
        </div>
      </div>
    </motion.div>
  );
}
