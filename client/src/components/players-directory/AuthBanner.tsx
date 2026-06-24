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
}

export function AuthBanner({
  session,
  ownProfile,
  authLoading,
  pendingMatches,
  onConfirmMatch,
  onRejectMatch,
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
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {m.player1.full_name}{" "}
                    <span className="text-amber-600 dark:text-amber-500 font-black italic mx-2">
                      VS
                    </span>{" "}
                    {m.player2.full_name}
                    <div className="text-xs text-slate-500 mt-1">
                      Score: <span className="font-bold">{m.score}</span> •
                      Winner:{" "}
                      <span className="font-bold text-emerald-600">
                        {m.winner_id === m.player1_id
                          ? m.player1.full_name
                          : m.player2.full_name}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => onConfirmMatch(m.id)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => onRejectMatch(m.id)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition"
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
          <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" /> Your Profile
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-emerald-300 dark:border-emerald-700 shadow-xl shadow-emerald-100/50 dark:shadow-none p-6 flex flex-col sm:flex-row items-center gap-6">
            <Link
              href={`/player/${ownProfile.id}`}
              className="flex items-center gap-4 flex-1 group min-w-0"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-400 shadow-md shrink-0">
                {ownProfile.avatar_url ? (
                  <img
                    loading="lazy"
                    src={ownProfile.avatar_url}
                    alt={ownProfile.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-2xl font-black text-emerald-600">
                    {ownProfile.full_name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {ownProfile.full_name}
                  {ownProfile.nickname && (
                    <span className="ml-2 text-sm font-semibold text-slate-400 italic whitespace-nowrap">
                      "{ownProfile.nickname}"
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {ownProfile.department} · Class of {ownProfile.joined_year}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
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
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-xl shadow-emerald-500/20">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <UserCircle className="w-9 h-9 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-black mb-1">
                You're in! Now create your player card 🏸
              </div>
              <div className="text-emerald-100 text-sm font-medium">
                You're signed in as{" "}
                <span className="font-bold text-white">
                  {session.user.email}
                </span>{" "}
                but haven't set up your profile yet.
              </div>
            </div>
            <button
              onClick={() => setLocation("/profile/setup")}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-emerald-700 font-black text-sm hover:bg-emerald-50 transition shadow-lg shrink-0"
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
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 rounded-3xl p-8 text-white shadow-xl border border-slate-700/50">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <UserCircle className="w-9 h-9 text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-black mb-1">
              Are you a member? Build your player card!
            </div>
            <div className="text-slate-300 text-sm font-medium">
              Sign in with your{" "}
              <span className="font-black text-emerald-400">
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
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition shadow-lg shadow-emerald-500/20 shrink-0"
          >
            <LogIn className="w-5 h-5" /> Sign In / Join
          </button>
        </div>
      </div>
    </motion.div>
  );
}
