import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Search, SlidersHorizontal, Users, Trophy, Sword, Sparkles,
  UserCircle, LogIn, PlusCircle, Pencil, ChevronRight, X, Trash2, Share2, ArrowUpDown
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import LogMatchModal from "@/components/LogMatchModal";
import { isAdminEmail } from "@/lib/admin";
import { PlayerCard, type Player, parseWinPct } from "@/components/players-directory/PlayerCard";
import { LeaderboardSection } from "./Leaderboard";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show:   { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
};

const PLAYER_SELECT =
  "id, full_name, nickname, department, joined_year, playing_level, playing_style, dominant_hand, avatar_url, current_racket, user_id, elo_rating, win_loss_record, recent_form";
const PLAYERS_CACHE_KEY = "iisc_players_directory_cache_v1";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_FETCH_RETRIES = 1;

function readCachedPlayers(): Player[] {
  try {
    const raw = window.localStorage.getItem(PLAYERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.players) ? parsed.players : [];
  } catch {
    return [];
  }
}

function cachePlayers(players: Player[]) {
  try {
    window.localStorage.setItem(
      PLAYERS_CACHE_KEY,
      JSON.stringify({ players, savedAt: Date.now() })
    );
  } catch {}
}
/* ── Main page ──────────────────────────────────────────────────────── */
export default function PlayersDirectory() {
  usePageMeta({
    title: "Player Directory",
    description:
      "Search and discover member profiles, styles, playing levels, and equipment within IISc Badminton Club.",
  });

  const [, setLocation] = useLocation();
  const isMountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);

  /* Auth + own-profile state */
  const [session, setSession]             = useState<any>(null);
  const [ownProfile, setOwnProfile]       = useState<Player | null>(null);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [isLogMatchOpen, setIsLogMatchOpen] = useState(false);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);

  /* Directory state */
  const [players, setPlayers]             = useState<Player[]>([]);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [levelFilter, setLevelFilter]         = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [showFilters, setShowFilters]     = useState(false);
  const [sortBy, setSortBy]               = useState<"elo" | "winpct" | "name" | "department" | "level">("name");
  const [activeTab, setActiveTab]         = useState<"directory" | "leaderboard">("directory");
  const [visibleCount, setVisibleCount]   = useState(24);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      fetchRequestIdRef.current += 1;
    };
  }, []);

  /* 1. Check auth session + own profile */
  const { session: authSession, isInitializing: authLoading, profile } = useAuth();
  useEffect(() => {
    let isMounted = true;

    const applySession = async (session: any) => {
      if (!session) {
        if (isMounted) {
          setSession(null);
          setOwnProfile(null);
          setIsAdmin(false);
        }
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (userError || !userData.user || userData.user.id !== session.user.id) {
        setSession(null);
        setOwnProfile(null);
        setIsAdmin(false);
        await supabase.auth.signOut();
        return;
      }

      setSession(session);

      if (session) {
        const adminStatus = isAdminEmail(userData.user.email);
        setIsAdmin(adminStatus);
        
        try {
          const { data } = await supabase
            .from("players")
            .select(PLAYER_SELECT)
            .eq("user_id", userData.user.id)
            .maybeSingle();
          if (isMounted) {
            setOwnProfile(data ?? null);
            if (data) {
              fetchPendingMatches(data.id);
            }
          }
        } catch (e) {
          console.warn("Error fetching own profile:", e);
        }
      }
    };

    applySession(authSession).catch(err => console.error("Auth apply error:", err));

    return () => { isMounted = false; };
  }, [authSession]);

  /* 2. Fetch all players — stale-while-revalidate.
        If we have cached data, show it instantly and refresh in the background.
        The loading spinner only appears on the very first visit (empty cache). */
  const fetchPlayers = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const requestId = ++fetchRequestIdRef.current;

    if (!silent) {
      setFetchError(false);

      const cachedPlayers = readCachedPlayers();
      if (cachedPlayers.length > 0) {
        // Show stale data instantly — no spinner
        setPlayers(cachedPlayers);
        setLoading(false);
        // From here on, treat this as a silent background refresh
        silent = true;
      } else {
        // No cache at all — first visit, show spinner
        setLoading(true);
      }
    }

    if (!isSupabaseConfigured) {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;

      const cachedPlayers = readCachedPlayers();
      if (cachedPlayers.length > 0) {
        setPlayers(cachedPlayers);
      } else if (!silent) {
        setFetchError(true);
      }
      setLoading(false);
      return;
    }

    for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await supabase
          .from("players")
          .select(PLAYER_SELECT)
          .is("deleted_at", null)
          .order("elo_rating", { ascending: false })
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;

        if (response.error) {
          throw response.error;
        }

        const nextPlayers = response.data || [];
        setPlayers(nextPlayers);
        cachePlayers(nextPlayers);
        setFetchError(false);
        setLoading(false);
        return;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (requestId !== fetchRequestIdRef.current) return;

        console.warn(`Player directory fetch failed (attempt ${attempt + 1}):`, err?.message ?? err);

        if (attempt < MAX_FETCH_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
          if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;
          continue;
        }

        if (!isMountedRef.current) return;

        const cachedPlayers = readCachedPlayers();
        if (cachedPlayers.length > 0) {
          setPlayers(cachedPlayers);
          setFetchError(false);
        } else if (!silent) {
          setFetchError(true);
        }
        setLoading(false);
      }
    }
  }, []);

  const fetchPendingMatches = useCallback(async (profileId: string) => {
    const fullRes = await supabase
      .from("matches")
      .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
      .eq("status", "pending")
      .neq("submitted_by", profileId)
      .or(`player1_id.eq.${profileId},player2_id.eq.${profileId},team1_partner_id.eq.${profileId},team2_partner_id.eq.${profileId}`);
    const res = fullRes.error
      ? await supabase
        .from("matches")
        .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
        .eq("status", "pending")
        .neq("submitted_by", profileId)
        .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
      : fullRes;
    setPendingMatches(res.data || []);
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    if (!loading) return;

    const stuckLoaderTimeout = setTimeout(() => {
      if (!isMountedRef.current) return;

      const cachedPlayers = readCachedPlayers();
      if (cachedPlayers.length > 0) {
        setPlayers(cachedPlayers);
        setFetchError(false);
      } else {
        setFetchError(true);
      }
      setLoading(false);
    }, REQUEST_TIMEOUT_MS * (MAX_FETCH_RETRIES + 2));

    return () => clearTimeout(stuckLoaderTimeout);
  }, [loading]);

  // Auto-refresh player list every 60s (silently, scroll preserved)
  const silentRefresh = useCallback(async () => {
    await fetchPlayers({ silent: true });
    if (ownProfile?.id) {
      fetchPendingMatches(ownProfile.id);
    }
  }, [fetchPlayers, ownProfile?.id, fetchPendingMatches]);
  useAutoRefresh(silentRefresh, 60_000, !loading);

  /* Filter + sort logic */
  const otherPlayers = players.filter((p) => p.user_id !== session?.user?.id);
  const allDepartments = Array.from(new Set(players.map(p => p.department).filter(Boolean))).sort();

  const filteredPlayers = otherPlayers
    .filter((player) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        player.full_name.toLowerCase().includes(q) ||
        (player.nickname && player.nickname.toLowerCase().includes(q)) ||
        player.department.toLowerCase().includes(q);
      const matchesLevel = levelFilter === "All" || player.playing_level === levelFilter;
      const matchesDept = departmentFilter === "All" || player.department === departmentFilter;
      return matchesSearch && matchesLevel && matchesDept;
    })
    .sort((a, b) => {
      if (sortBy === "elo")    return (b.elo_rating ?? 0) - (a.elo_rating ?? 0);
      if (sortBy === "winpct") return (parseWinPct(b.win_loss_record) ?? 0) - (parseWinPct(a.win_loss_record) ?? 0);
      if (sortBy === "department") return (a.department || "").localeCompare(b.department || "");
      if (sortBy === "level") return (a.playing_level || "").localeCompare(b.playing_level || "");
      if (sortBy === "name")   return a.full_name.localeCompare(b.full_name);
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
    // Still loading auth — show nothing (prevents flash of "not logged in")
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
                  <img loading="lazy" src={ownProfile.avatar_url} alt={ownProfile.full_name} className="w-full h-full object-cover" />
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

    /* Not logged in — but only show this if we are SURE there's no session */
    if (session) return null; // session exists, ownProfile is still loading
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
                Sign in with your <span className="font-black text-emerald-400">preferred personal Gmail account</span> to create and manage your profile.
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
          
          {/* View Toggle */}
          <div className="mt-10 flex justify-center relative z-10">
            <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20">
              <button
                onClick={() => setActiveTab('directory')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === 'directory'
                    ? 'bg-white text-emerald-700 shadow-md scale-100'
                    : 'text-white/80 hover:text-white hover:bg-white/10 scale-95'
                }`}
              >
                <Users className="w-4 h-4" /> Directory
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === 'leaderboard'
                    ? 'bg-white text-emerald-700 shadow-md scale-100'
                    : 'text-white/80 hover:text-white hover:bg-white/10 scale-95'
                }`}
              >
                <Trophy className="w-4 h-4" /> Leaderboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="container mx-auto px-4 py-12 max-w-7xl">

        {/* Auth banner */}
        {renderAuthBanner()}

        {activeTab === 'directory' ? (
          <>
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
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="pl-9 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                >
                  <option value="elo">By ELO</option>
                  <option value="winpct">By Win %</option>
                  <option value="name">By Name</option>
                  <option value="department">By Department</option>
                  <option value="level">By Level</option>
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
                {(levelFilter !== "All" || departmentFilter !== "All") && (
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
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Department</label>
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="All">All Departments</option>
                      {allDepartments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  {(levelFilter !== "All" || departmentFilter !== "All") && (
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        onClick={() => { setLevelFilter("All"); setDepartmentFilter("All"); }}
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
          {(searchQuery || levelFilter !== "All" || departmentFilter !== "All") && (
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Showing <span className="text-emerald-600 dark:text-emerald-400">{filteredPlayers.length}</span> of {otherPlayers.length} players
            </p>
          )}
        </div>

        {/* Recommended Opponents (Matchmaking) */}
        {!loading && ownProfile && activeTab === 'directory' && (
          (function() {
            
            const buddiesLooking = players.filter(p => 
              (ownProfile as any).buddies?.includes(p.id) && p.status === 'looking'
            );

            const recommended = players.filter(p => 
              p.id !== ownProfile.id && 
              p.status === 'looking' && 
              Math.abs((p.elo_rating || 1200) - (ownProfile.elo_rating || 1200)) <= 150
            ).slice(0, 4);
            
            if (recommended.length === 0) return null;
            
            return (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                    <Sword className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Recommended Matches</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Players with similar skill looking to play right now</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {recommended.map(player => (
                    <PlayerCard 

                      key={"rec-" + player.id}
                      player={player} 
                      isOwn={false} 
                      isAdmin={isAdmin} 
                      onDelete={handleAdminDelete} 
                      onEdit={handleAdminEdit}
                      onLogMatch={ownProfile ? () => { setSelectedOpponentId(player.id); setIsLogMatchOpen(true); } : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })()
        )}

        {/* Directory grid (others) */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-56 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                </div>
                <div className="space-y-3 mt-auto">
                  <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
            <p className="text-slate-700 dark:text-slate-300 font-bold">
              {isSupabaseConfigured ? "No connection to server" : "Player directory is not configured"}
            </p>
            <p className="text-slate-400 text-sm max-w-md">
              {isSupabaseConfigured
                ? "This app requires internet to load player data."
                : "The deployed site is missing Supabase environment variables."}
            </p>
            <button onClick={() => fetchPlayers()} className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition">
              Retry
            </button>
          </div>
        ) : filteredPlayers.length > 0 ? (
          <>
            {(searchQuery || levelFilter !== "All" || departmentFilter !== "All") ? null : (
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
              {filteredPlayers.slice(0, visibleCount).map((player) => (
                <motion.div 
                  key={player.id} 
                  variants={itemVariants} 
                  className="group h-full cursor-pointer"
                  onClick={() => setLocation(`/player/${player.id}`)}
                >
                  <PlayerCard 
                    player={player} 
                    isAdmin={isAdmin}
                    onDelete={handleAdminDelete}
                    onEdit={handleAdminEdit}
                    onLogMatch={ownProfile ? () => {
                      setSelectedOpponentId(player.id);
                      setIsLogMatchOpen(true);
                    } : undefined}
                  />
                </motion.div>
              ))}
            </motion.div>
            
            {visibleCount < filteredPlayers.length && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setVisibleCount(v => v + 24)}
                  className="px-8 py-3 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex items-center gap-2"
                >
                  Load More Players
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-12 text-center border border-dashed border-slate-200 dark:border-slate-800">
            <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">No players found</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 text-sm">
              Try adjusting your search or filters.
            </p>
            <button
              onClick={() => { setSearchQuery(""); setLevelFilter("All"); setDepartmentFilter("All"); }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition text-xs"
            >
              Reset Filters
            </button>
          </div>
        )}
          </>
        ) : (
          <div className="mt-8">
            <LeaderboardSection players={players as any} />
          </div>
        )}

      </section>

      {/* Log Match Modal */}
      {ownProfile && (
        <LogMatchModal 
          isOpen={isLogMatchOpen} 
          onClose={() => {
            setIsLogMatchOpen(false);
            setSelectedOpponentId(null);
          }} 
          currentUser={ownProfile as any}
          otherPlayers={otherPlayers as any}
          onSuccess={fetchPlayers}
          defaultOpponentId={selectedOpponentId || undefined}
        />
      )}
    </div>
  );
}






