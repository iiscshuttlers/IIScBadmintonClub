import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, SlidersHorizontal, Users, Trophy, Sword, Sparkles,
  UserCircle, LogIn, PlusCircle, Pencil, ChevronRight, X, Trash2, Share2, ArrowUpDown
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/usePageMeta";
import LogMatchModal from "@/components/LogMatchModal";

interface Player {
  id: string;
  full_name: string;
  nickname?: string;
  department: string;
  joined_year: number;
  playing_level: string;
  playing_style: string;
  dominant_hand: string;
  avatar_url: string;
  current_racket?: string;
  user_id?: string;
  elo_rating?: number;
  win_loss_record?: string;
  recent_form?: string[];
}

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-500",
  "from-blue-400 to-indigo-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-cyan-400 to-sky-500",
];

function avatarGradient(name: string) {
  const sum = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
}

function parseWinPct(record?: string): number | null {
  if (!record) return null;
  const m = record.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
  if (!m) return null;
  const w = +m[1], l = +m[2];
  return w + l ? Math.round((w / (w + l)) * 100) : null;
}

const levelColor: Record<string, string> = {
  Advanced:      "bg-amber-50   dark:bg-amber-950/20  text-amber-700   dark:text-amber-400  border border-amber-100  dark:border-amber-900/30",
  Professional:  "bg-amber-50   dark:bg-amber-950/20  text-amber-700   dark:text-amber-400  border border-amber-100  dark:border-amber-900/30",
  Intermediate:  "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30",
  Beginner:      "bg-slate-100  dark:bg-slate-800      text-slate-600   dark:text-slate-300",
};

const containerVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show:   { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
};

/* ── Small reusable player card ─────────────────────────────────────── */
function PlayerCard({ player, isOwn = false, isAdmin = false, onDelete, onEdit }: { player: Player; isOwn?: boolean; isAdmin?: boolean; onDelete?: (id: string) => void; onEdit?: (id: string) => void; }) {
  const winPct = parseWinPct(player.win_loss_record);

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/player/${player.id}`;
    if (navigator.share) {
      navigator.share({ title: player.full_name, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => alert("Profile link copied!")).catch(() => {});
    }
  };

  return (
    <Card
      className={`h-full rounded-[2rem] overflow-hidden cursor-pointer border bg-white dark:bg-slate-900
        hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-none hover:-translate-y-1.5
        transition-all duration-300 flex flex-col justify-between group relative
        ${isOwn
          ? "border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/30"
          : "border-slate-100 dark:border-slate-800"}`}
    >
      {isOwn && (
        <span className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest shadow">
          You
        </span>
      )}

      {/* Share button — always visible on hover */}
      <button
        onClick={handleShare}
        className="absolute top-3 right-3 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shadow transition opacity-0 group-hover:opacity-100"
        title="Copy profile link"
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>

      {/* Admin Actions */}
      {isAdmin && !isOwn && (
        <div className="absolute top-3 right-10 z-20 flex gap-1.5" onClick={(e) => e.preventDefault()}>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit?.(player.id); }}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 shadow transition"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(player.id); }}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 shadow transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <CardContent className="p-6 flex flex-col items-center text-center space-y-3 h-full relative">
        {/* Department chip */}
        <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider">
          {player.department.split(" ").slice(0, 2).join(" ")}
        </span>

        {/* Elo Rating chip
        {player.elo_rating != null && (
          <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-orange-500/20">
            {player.elo_rating} ELO
          </span>
        )} */}

        {/* Avatar */}
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-md group-hover:scale-105 transition-transform duration-300 shrink-0 mt-4">
          {player.avatar_url ? (
            <img src={player.avatar_url} alt={player.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${avatarGradient(player.full_name)} flex items-center justify-center text-white font-black text-3xl`}>
              {player.full_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
            {player.full_name}
          </h3>
          {player.nickname && (
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
              "{player.nickname}"
            </span>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest ${levelColor[player.playing_level] ?? levelColor.Beginner}`}>
            {player.playing_level}
          </span>
          {player.dominant_hand && (
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 text-[10px] font-extrabold uppercase tracking-widest">
              {player.dominant_hand.split("-")[0]}
            </span>
          )}
        </div>

        {/* Win % + Recent Form */}
        {(winPct !== null || (player.recent_form && player.recent_form.length > 0)) && (
          <div className="flex flex-col items-center gap-1.5 w-full">
            {winPct !== null && (
              <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                {winPct}% win rate · <span className="text-slate-400 font-semibold">{player.win_loss_record}</span>
              </span>
            )}
            {player.recent_form && player.recent_form.length > 0 && (
              <div className="flex gap-1 justify-center">
                {player.recent_form.slice(-5).map((r, i) => (
                  <div
                    key={i}
                    className={`w-5 h-5 rounded text-[9px] font-black flex items-center justify-center text-white
                      ${r === "W" ? "bg-emerald-500" : "bg-rose-500"}`}
                  >
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Racket */}
        {player.current_racket && (
          <div className="w-full pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-bold mt-auto">
            <Sword className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate max-w-[150px]">{player.current_racket}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function PlayersDirectory() {
  usePageMeta({
    title: "Player Directory",
    description:
      "Search and discover member profiles, styles, playing levels, and equipment within IISc Badminton Club.",
  });

  const [, setLocation] = useLocation();

  /* Auth + own-profile state */
  const [session, setSession]             = useState<any>(null);
  const [ownProfile, setOwnProfile]       = useState<Player | null>(null);
  const [authLoading, setAuthLoading]     = useState(true);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [isLogMatchOpen, setIsLogMatchOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);

  /* Directory state */
  const [players, setPlayers]             = useState<Player[]>([]);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [levelFilter, setLevelFilter]     = useState("All");
  const [styleFilter, setStyleFilter]     = useState("All");
  const [showFilters, setShowFilters]     = useState(false);
  const [sortBy, setSortBy]               = useState<"elo" | "winpct" | "name">("name");

  /* 1. Check auth session + own profile */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);

      if (session) {
        const adminStatus = session.user.email === 'iiscbadmintonclub@gmail.com' || session.user.email === 'janmejay@iisc.ac.in';
        setIsAdmin(adminStatus);
        
        const { data } = await supabase
          .from("players")
          .select("id, full_name, nickname, department, joined_year, playing_level, playing_style, dominant_hand, avatar_url, current_racket, user_id, elo_rating, win_loss_record, recent_form")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setOwnProfile(data ?? null);
        if (data) {
          fetchPendingMatches(data.id);
        }
      }
      setAuthLoading(false);
    });

    // Listen for auth state changes (e.g. sign-in in another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setOwnProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* 2. Fetch all players (with retry logic) */
  const fetchPlayers = async (retryCount = 0) => {
    setFetchError(false);
    setLoading(true);

    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 20000;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const { data, error } = await supabase
        .from("players")
        .select("id, full_name, nickname, department, joined_year, playing_level, playing_style, dominant_hand, avatar_url, current_racket, user_id, elo_rating")
        .is("deleted_at", null)
        .order("elo_rating", { ascending: false })
        .abortSignal(controller.signal);

      clearTimeout(timeout);

      if (!error && data) {
        setPlayers(data);
        setLoading(false);
      } else if (error) {
        console.warn("Supabase fetch error:", error.message);
        if (retryCount < MAX_RETRIES) {
          const delay = 1000 * Math.pow(2, retryCount);
          await new Promise((r) => setTimeout(r, delay));
          return fetchPlayers(retryCount + 1);
        }
        setFetchError(true);
        setLoading(false);
      }
    } catch (err: any) {
      console.warn("Network error fetching players:", err?.message);
      if (retryCount < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, retryCount);
        await new Promise((r) => setTimeout(r, delay));
        return fetchPlayers(retryCount + 1);
      }
      setFetchError(true);
      setLoading(false);
    }
  };

  const fetchPendingMatches = async (profileId: string) => {
    const { data } = await supabase
      .from("matches")
      .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
      .eq("status", "pending")
      .neq("submitted_by", profileId)
      .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`);
    setPendingMatches(data || []);
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  /* Filter + sort logic */
  const otherPlayers = players.filter((p) => p.user_id !== session?.user?.id);
  const filteredPlayers = otherPlayers
    .filter((player) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        player.full_name.toLowerCase().includes(q) ||
        (player.nickname && player.nickname.toLowerCase().includes(q)) ||
        player.department.toLowerCase().includes(q);
      const matchesLevel = levelFilter === "All" || player.playing_level === levelFilter;
      const matchesStyle =
        styleFilter === "All" ||
        player.playing_style?.toLowerCase().includes(styleFilter.toLowerCase());
      return matchesSearch && matchesLevel && matchesStyle;
    })
    .sort((a, b) => {
      if (sortBy === "elo")    return (b.elo_rating ?? 0) - (a.elo_rating ?? 0);
      if (sortBy === "name")   return a.full_name.localeCompare(b.full_name);
      if (sortBy === "winpct") return (parseWinPct(b.win_loss_record) ?? 0) - (parseWinPct(a.win_loss_record) ?? 0);
      return 0;
    });

  const handleSignOut = async () => {
    if (confirm("Sign out of your account?")) {
      await supabase.auth.signOut();
      setSession(null);
      setOwnProfile(null);
    }
  };

  const handleConfirmMatch = async (matchId: string) => {
    try {
      const { data, error } = await supabase.rpc("confirm_friendly_match", { match_uuid: matchId, confirmer_id: ownProfile?.id });
      if (error) throw error;
      alert(`Match Confirmed! Elo Ratings Updated.\nYour Elo Change: ${data.p1_elo_change || data.p2_elo_change}`);
      fetchPendingMatches(ownProfile!.id);
      fetchPlayers(); // To refresh Elo if we displayed it
    } catch (e: any) {
      alert("Error confirming match: " + e.message);
    }
  };

  const handleRejectMatch = async (matchId: string) => {
    try {
      const { error } = await supabase.rpc("reject_friendly_match", { match_uuid: matchId, rejecter_id: ownProfile?.id });
      if (error) throw error;
      alert("Match Rejected.");
      fetchPendingMatches(ownProfile!.id);
    } catch (e: any) {
      alert("Error rejecting match: " + e.message);
    }
  };

  const handleAdminDelete = async (playerId: string) => {
    if (confirm("Are you sure you want to delete this player? They can be restored within 30 days.")) {
      try {
        const { error } = await supabase.rpc("soft_delete_player", { player_id: playerId, admin_email: session?.user?.email });
        if (error) throw error;
        alert("Player successfully soft-deleted.");
        fetchPlayers();
      } catch (err: any) {
        alert("Delete failed: " + err.message);
      }
    }
  };

  const handleAdminEdit = (playerId: string) => {
    setLocation(`/player/${playerId}/edit`);
  };

  /* ── Auth banner (top of page) ─────────────────────────────────── */
  const renderAuthBanner = () => {
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
                <Sword className="w-5 h-5" /> Pending Match Verifications ({pendingMatches.length})
              </h3>
              <div className="space-y-3">
                {pendingMatches.map(m => (
                  <div key={m.id} className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/60 dark:bg-black/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {m.player1.full_name} <span className="text-amber-600 dark:text-amber-500 font-black italic mx-2">VS</span> {m.player2.full_name}
                      <div className="text-xs text-slate-500 mt-1">Score: <span className="font-bold">{m.score}</span> • Winner: <span className="font-bold text-emerald-600">{m.winner_id === m.player1_id ? m.player1.full_name : m.player2.full_name}</span></div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => handleConfirmMatch(m.id)} className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition">Confirm</button>
                      <button onClick={() => handleRejectMatch(m.id)} className="flex-1 sm:flex-none px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition">Reject</button>
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
            {/* Mini avatar + name */}
            <Link href={`/player/${ownProfile.id}`} className="flex items-center gap-4 flex-1 group min-w-0">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-400 shadow-md shrink-0">
                {ownProfile.avatar_url ? (
                  <img src={ownProfile.avatar_url} alt={ownProfile.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-2xl font-black text-emerald-600">
                    {ownProfile.full_name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                  {ownProfile.full_name}
                  {ownProfile.nickname && (
                    <span className="ml-2 text-sm font-semibold text-slate-400 italic">"{ownProfile.nickname}"</span>
                  )}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate">
                  {ownProfile.department} · Class of {ownProfile.joined_year}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  View full profile <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 shrink-0">
              <button
                onClick={() => setIsLogMatchOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/25 transition"
              >
                <Sword className="w-4 h-4" /> Log Match
              </button>
              <button
                onClick={() => setLocation(`/player/${ownProfile.id}/edit`)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md shadow-emerald-500/25 transition"
              >
                <Pencil className="w-4 h-4" /> Edit Profile
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 text-sm font-bold transition"
              >
                Sign Out
              </button>
            </div>
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
                <div className="text-lg font-black mb-1">You're in! Now create your player card 🏸</div>
                <div className="text-emerald-100 text-sm font-medium">
                  You're signed in as <span className="font-bold text-white">{session.user.email}</span> but haven't set up your profile yet.
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

    /* Not logged in */
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
              <div className="text-lg font-black mb-1">Are you a member? Build your player card!</div>
              <div className="text-slate-300 text-sm font-medium">
                Sign in with your <span className="font-bold text-white">@iisc.ac.in</span> email to create and manage your profile.
              </div>
            </div>
            <button
              onClick={() => setLocation("/join")}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition shadow-lg shadow-emerald-500/20 shrink-0"
            >
              <LogIn className="w-5 h-5" /> Sign In / Join
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Hero header */}
      <section className="bg-gradient-to-r from-blue-900 via-indigo-950 to-emerald-900 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.1),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-bold mb-5 backdrop-blur-sm">
            <Users className="w-4 h-4 text-emerald-400" />
            Club Roster
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-5 tracking-tight">Player Directory</h1>
          <p className="text-lg sm:text-xl text-slate-200 max-w-3xl mx-auto font-medium leading-relaxed">
            Discover and connect with badminton players, teammates, and tournament champions across IISc departments.
          </p>
          <div className="mt-6 text-slate-300 text-sm font-medium">
            {!loading && (
              <span className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-sm">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                {players.length} member{players.length !== 1 ? "s" : ""} in the directory
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="container mx-auto px-4 py-12 max-w-7xl">

        {/* Auth banner */}
        {renderAuthBanner()}

        {/* Search + Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 mb-10 space-y-5">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, nickname, or department..."
                className="w-full pl-12 pr-10 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-semibold"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              {/* Sort selector */}
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "elo" | "winpct" | "name")}
                  className="pl-9 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                >
                  {/* <option value="elo">By ELO</option> */}
                  <option value="winpct">By Win %</option>
                  <option value="name">By Name</option>
                </select>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-bold transition
                  ${showFilters
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {(levelFilter !== "All" || styleFilter !== "All") && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Expandable filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Playing Level</label>
                    <select
                      value={levelFilter}
                      onChange={(e) => setLevelFilter(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="All">All Levels</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Professional">Professional</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Playing Style</label>
                    <select
                      value={styleFilter}
                      onChange={(e) => setStyleFilter(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="All">All Styles</option>
                      <option value="Aggressive">Aggressive</option>
                      <option value="Defensive">Defensive</option>
                      <option value="All-round">All-round / Balanced</option>
                    </select>
                  </div>
                  {(levelFilter !== "All" || styleFilter !== "All") && (
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        onClick={() => { setLevelFilter("All"); setStyleFilter("All"); }}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Clear filters
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result count */}
          {(searchQuery || levelFilter !== "All" || styleFilter !== "All") && (
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Showing <span className="text-emerald-600 dark:text-emerald-400">{filteredPlayers.length}</span> of {otherPlayers.length} players
            </p>
          )}
        </div>

        {/* Directory grid (others) */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 font-bold">Assembling club roster...</p>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
            <p className="text-2xl">🔌</p>
            <p className="text-slate-700 dark:text-slate-300 font-bold">No connection to server</p>
            <p className="text-slate-400 text-sm">This app requires internet to load player data.</p>
            <button onClick={fetchPlayers} className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition">
              Retry
            </button>
          </div>
        ) : filteredPlayers.length > 0 ? (
          <>
            {(searchQuery || levelFilter !== "All" || styleFilter !== "All") ? null : (
              <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" /> All Members
              </h2>
            )}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {filteredPlayers.map((player) => (
                <motion.div key={player.id} variants={itemVariants} className="group h-full">
                  <Link href={`/player/${player.id}`}>
                    <PlayerCard 
                      player={player} 
                      isAdmin={isAdmin}
                      onDelete={handleAdminDelete}
                      onEdit={handleAdminEdit}
                    />
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-12 text-center border border-dashed border-slate-200 dark:border-slate-800">
            <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">No players found</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 text-sm">
              Try adjusting your search or filters.
            </p>
            <button
              onClick={() => { setSearchQuery(""); setLevelFilter("All"); setStyleFilter("All"); }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition text-xs"
            >
              Reset Filters
            </button>
          </div>
        )}

      </section>

      {/* Log Match Modal */}
      {ownProfile && (
        <LogMatchModal 
          isOpen={isLogMatchOpen} 
          onClose={() => setIsLogMatchOpen(false)} 
          currentUser={ownProfile as any}
          otherPlayers={otherPlayers as any}
          onSuccess={fetchPlayers}
        />
      )}
    </div>
  );
}
