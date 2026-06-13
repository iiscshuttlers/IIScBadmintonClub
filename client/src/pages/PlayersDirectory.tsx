import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  Users,
  Trophy,
  Sword,
  Swords,
  Sparkles,
  UserCircle,
  LogIn,
  PlusCircle,
  Pencil,
  ChevronRight,
  X,
  Trash2,
  Share2,
  ArrowUpDown,
  Zap,
  Heart,
  UserCheck,
  Activity,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import LogMatchModal from "@/components/LogMatchModal";
import { isAdminEmail } from "@/lib/admin";
import {
  PlayerCard,
  type Player,
  parseWinPct,
} from "@/components/players-directory/PlayerCard";
import { LeaderboardSection } from "./Leaderboard";
import { H2HSection } from "@/components/players-directory/H2HSection";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
};

const PLAYER_SELECT =
  "id, full_name, nickname, department, joined_year, playing_level, playing_style, dominant_hand, avatar_url, current_racket, user_id, elo_rating, win_loss_record, recent_form, is_looking_to_play, buddies, following, buddy_requests, gender";
const PLAYERS_CACHE_KEY = "iisc_players_directory_cache_v2";
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
      JSON.stringify({ players, savedAt: Date.now() }),
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
  const [session, setSession] = useState<any>(null);
  const [ownProfile, setOwnProfile] = useState<Player | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLogMatchOpen, setIsLogMatchOpen] = useState(false);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(
    null,
  );
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);

  /* Directory state */
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [levelFilter, setLevelFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<
    "elo" | "winpct" | "name" | "department" | "level"
  >("name");
  const [activeTab, setActiveTab] = useState<"directory" | "leaderboard" | "network" | "h2h">(
    "directory",
  );
  const [followers, setFollowers] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(24);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      fetchRequestIdRef.current += 1;
    };
  }, []);

  // Debounce search input by 150ms
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  /* 1. Check auth session + own profile */
  const {
    session: authSession,
    isInitializing: authLoading,
    profile,
  } = useAuth();
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

      const { data: userData, error: userError } =
        await supabase.auth.getUser();
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
              fetchFollowers(data.id);
            }
          }
        } catch (e) {
          console.warn("Error fetching own profile:", e);
        }
      }
    };

    applySession(authSession).catch((err) =>
      console.error("Auth apply error:", err),
    );

    return () => {
      isMounted = false;
    };
  }, [authSession]);

  /* 2. Fetch all players — stale-while-revalidate.
        If we have cached data, show it instantly and refresh in the background.
        The loading spinner only appears on the very first visit (empty cache). */
  const fetchPlayers = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
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
        if (!isMountedRef.current || requestId !== fetchRequestIdRef.current)
          return;

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
        const timeoutId = setTimeout(
          () => controller.abort(),
          REQUEST_TIMEOUT_MS,
        );

        try {
          const response = await supabase
            .from("players")
            .select(PLAYER_SELECT)
            .is("deleted_at", null)
            .order("elo_rating", { ascending: false })
            .abortSignal(controller.signal);

          clearTimeout(timeoutId);

          if (!isMountedRef.current || requestId !== fetchRequestIdRef.current)
            return;

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

          console.warn(
            `Player directory fetch failed (attempt ${attempt + 1}):`,
            err?.message ?? err,
          );

          if (attempt < MAX_FETCH_RETRIES) {
            await new Promise((resolve) =>
              setTimeout(resolve, 750 * (attempt + 1)),
            );
            if (
              !isMountedRef.current ||
              requestId !== fetchRequestIdRef.current
            )
              return;
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
    },
    [],
  );

  const fetchFollowers = useCallback(async (profileId: string) => {
    try {
      const { data } = await supabase
        .from("players")
        .select("id, full_name, avatar_url, department, elo_rating, is_looking_to_play, playing_level")
        .contains("following", [profileId])
        .is("deleted_at", null);
      if (data) setFollowers(data);
    } catch {
      // ignore — followers list is non-critical
    }
  }, []);

  const fetchPendingMatches = useCallback(async (profileId: string) => {
    const fullRes = await supabase
      .from("matches")
      .select(
        "*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)",
      )
      .eq("status", "pending")
      .neq("submitted_by", profileId)
      .or(
        `player1_id.eq.${profileId},player2_id.eq.${profileId},team1_partner_id.eq.${profileId},team2_partner_id.eq.${profileId}`,
      );
    const res = fullRes.error
      ? await supabase
          .from("matches")
          .select(
            "*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)",
          )
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

    const stuckLoaderTimeout = setTimeout(
      () => {
        if (!isMountedRef.current) return;

        const cachedPlayers = readCachedPlayers();
        if (cachedPlayers.length > 0) {
          setPlayers(cachedPlayers);
          setFetchError(false);
        } else {
          setFetchError(true);
        }
        setLoading(false);
      },
      REQUEST_TIMEOUT_MS * (MAX_FETCH_RETRIES + 2),
    );

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
  const allDepartments = Array.from(
    new Set(players.map((p) => p.department).filter(Boolean)),
  ).sort();

  // IDs of own buddies for hoisting
  const myBuddyIds = new Set<string>((ownProfile as any)?.buddies || []);
  const followingIds = new Set<string>((ownProfile as any)?.following || []);

  const filteredPlayers = otherPlayers
    .filter((player) => {
      const q = debouncedSearchQuery.toLowerCase();
      const matchesSearch =
        player.full_name.toLowerCase().includes(q) ||
        (player.nickname && player.nickname.toLowerCase().includes(q)) ||
        player.department.toLowerCase().includes(q);
      const matchesLevel =
        levelFilter === "All" || player.playing_level === levelFilter;
      const matchesDept =
        departmentFilter === "All" || player.department === departmentFilter;
      return matchesSearch && matchesLevel && matchesDept;
    })
    .sort((a, b) => {
      // Hoist Looking-to-Play buddies above everyone else
      const aIsLtpBuddy = (a as any).is_looking_to_play && myBuddyIds.has(a.id);
      const bIsLtpBuddy = (b as any).is_looking_to_play && myBuddyIds.has(b.id);
      if (aIsLtpBuddy && !bIsLtpBuddy) return -1;
      if (!aIsLtpBuddy && bIsLtpBuddy) return 1;

      if (sortBy === "elo") return (b.elo_rating ?? 0) - (a.elo_rating ?? 0);
      if (sortBy === "winpct")
        return (
          (parseWinPct(b.win_loss_record) ?? 0) -
          (parseWinPct(a.win_loss_record) ?? 0)
        );
      if (sortBy === "department")
        return (a.department || "").localeCompare(b.department || "");
      if (sortBy === "level")
        return (a.playing_level || "").localeCompare(b.playing_level || "");
      if (sortBy === "name") return a.full_name.localeCompare(b.full_name);
      return 0;
    });

  const handleSignOut = async () => {
    if (confirm("Sign out of your account?")) {
      await supabase.auth.signOut();
      setSession(null);
      setOwnProfile(null);
    }
  };

  const myBuddyRequests = new Set<string>((ownProfile as any)?.buddy_requests || []);

  const handleBuddyAction = async (playerId: string, action: 'send'|'cancel'|'accept'|'remove') => {
    if (!ownProfile?.id || !session?.user?.id) return;
    const isBuddy = myBuddyIds.has(playerId);
    const targetPlayer = players.find(p => p.id === playerId);
    
    try {
      if (action === 'send') {
        const currentRequests = (targetPlayer as any)?.buddy_requests || [];
        const newRequests = Array.from(new Set([...currentRequests, ownProfile.id]));
        const { error } = await supabase.rpc('send_buddy_request', { p_target_id: playerId });
        if (error) throw error;
        setPlayers(players.map(p => p.id === playerId ? { ...p, buddy_requests: newRequests } : p));
        toast.success(`Buddy request sent!`);
      } else if (action === 'cancel') {
        const currentRequests = (targetPlayer as any)?.buddy_requests || [];
        const newRequests = currentRequests.filter((id: string) => id !== ownProfile.id);
        const { error } = await supabase.rpc('cancel_buddy_request', { p_target_id: playerId });
        if (error) throw error;
        setPlayers(players.map(p => p.id === playerId ? { ...p, buddy_requests: newRequests } : p));
        toast.success(`Buddy request cancelled.`);
      } else if (action === 'accept') {
        // Remove from my requests, add to my buddies
        const myNewRequests = Array.from(new Set((ownProfile as any).buddy_requests || [])).filter((id) => id !== playerId);
        const myNewBuddies = Array.from(new Set([...((ownProfile as any).buddies || []), playerId]));
        
        // Add me to their buddies
        const theirNewBuddies = Array.from(new Set([...((targetPlayer as any)?.buddies || []), ownProfile.id]));
        
        const { error } = await supabase.rpc('accept_buddy_request', { p_target_id: playerId });
        if (error) throw error;

        setPlayers(players.map(p => p.id === playerId ? { ...p, buddies: theirNewBuddies } : p));
        setOwnProfile((prev: any) => prev ? { ...prev, buddy_requests: myNewRequests, buddies: myNewBuddies } : prev);
        toast.success(`You are now buddies!`);
        
        await supabase.from("site_data").upsert({
          key: "latest_buddy_acceptance",
          value: {
            accepterId: ownProfile.id,
            accepterName: ownProfile.full_name,
            senderId: playerId,
            timestamp: Date.now()
          }
        }, { onConflict: "key" });
      } else if (action === 'remove') {
        const newBuddies = new Set(myBuddyIds);
        newBuddies.delete(playerId);
        setOwnProfile((prev: any) => prev ? { ...prev, buddies: Array.from(newBuddies) } : prev);
        const { error } = await supabase.rpc('remove_buddy', { p_target_id: playerId });
        if (error) throw error;
        toast.success(`Removed from buddies.`);
      }
      
      // Trigger a silent refresh of players to update states
      fetchPlayers({ silent: true });
    } catch (e) {
      console.error("Buddy action failed in directory:", e);
      toast.error("Could not complete buddy action.");
    }
  };

  const handleToggleFollow = async (playerId: string) => {
    if (!ownProfile?.id || !session?.user?.id) return;
    const isFollowing = followingIds.has(playerId);
    
    const newFollowing = new Set(followingIds);
    if (isFollowing) newFollowing.delete(playerId);
    else newFollowing.add(playerId);
    
    setOwnProfile((prev: any) => prev ? { ...prev, following: Array.from(newFollowing) } : prev);
    
    try {
      const { error } = await supabase
        .from("players")
        .update({ following: Array.from(newFollowing) })
        .eq("user_id", session.user.id);
      
      if (error) throw error;
      const player = players.find(p => p.id === playerId);
      toast.success(!isFollowing ? `Following ${player?.full_name || 'player'}!` : `Unfollowed.`);
    } catch (e) {
      setOwnProfile((prev: any) => prev ? { ...prev, following: Array.from(followingIds) } : prev);
      toast.error("Could not update follow status.");
    }
  };

  const handleToggleLtp = async () => {
    if (!ownProfile?.id) return;
    const next = !(ownProfile as any).is_looking_to_play;
    setOwnProfile((prev: any) =>
      prev ? { ...prev, is_looking_to_play: next } : prev,
    );
    const { error } = await supabase
      .from("players")
      .update({ is_looking_to_play: next })
      .eq("id", ownProfile.id);
    if (error) {
      setOwnProfile((prev: any) =>
        prev ? { ...prev, is_looking_to_play: !next } : prev,
      );
      toast.error("Could not update status");
    } else {
      toast.success(
        next
          ? "You are now looking to play! Buddies can see your status."
          : "Status cleared.",
      );
    }
  };

  const handleConfirmMatch = async (matchId: string) => {
    try {
      const { data, error } = await supabase.rpc("confirm_friendly_match", {
        match_uuid: matchId,
        confirmer_id: ownProfile?.id,
      });
      if (error) throw error;
      alert("Match Confirmed! Elo Ratings Updated.");
      fetchPendingMatches(ownProfile!.id);
      fetchPlayers(); // To refresh Elo if we displayed it
    } catch (e: any) {
      alert("Error confirming match: " + e.message);
    }
  };

  const handleRejectMatch = async (matchId: string) => {
    try {
      const { error } = await supabase.rpc("reject_friendly_match", {
        match_uuid: matchId,
        rejecter_id: ownProfile?.id,
      });
      if (error) throw error;
      alert("Match Rejected.");
      fetchPendingMatches(ownProfile!.id);
    } catch (e: any) {
      alert("Error rejecting match: " + e.message);
    }
  };

  const handleAdminDelete = async (playerId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this player? They can be restored within 30 days.",
      )
    ) {
      try {
        const { error } = await supabase.rpc("soft_delete_player", {
          player_id: playerId,
          admin_email: session?.user?.email,
        });
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
                        onClick={() => handleConfirmMatch(m.id)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleRejectMatch(m.id)}
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
              {/* Mini avatar + name */}
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
                  <div className="text-xl font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                    {ownProfile.full_name}
                    {ownProfile.nickname && (
                      <span className="ml-2 text-sm font-semibold text-slate-400 italic">
                        "{ownProfile.nickname}"
                      </span>
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
    <div className="flex-1 w-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Hero header */}
      <section className="bg-gradient-to-r from-blue-900 via-indigo-950 to-emerald-900 text-white py-6 sm:py-8 relative overflow-hidden shrink-0">
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col items-center justify-center gap-6">
            {/* View Toggle */}
            <div className="w-full md:w-auto flex justify-center">
              <div className="flex flex-wrap sm:flex-nowrap bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 gap-1.5 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab("directory")}
                  className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-black transition-all flex-1 basis-[45%] sm:basis-auto shrink-0 ${
                    activeTab === "directory"
                      ? "bg-white text-emerald-700 shadow-md scale-100"
                      : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                  }`}
                >
                  <Users className="w-4 h-4" /> Directory
                </button>
                <button
                  onClick={() => setActiveTab("leaderboard")}
                  className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-black transition-all flex-1 basis-[45%] sm:basis-auto shrink-0 ${
                    activeTab === "leaderboard"
                      ? "bg-white text-emerald-700 shadow-md scale-100"
                      : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                  }`}
                >
                  <Trophy className="w-4 h-4" /> Rankings
                </button>
                <button
                  onClick={() => setActiveTab("h2h")}
                  className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-black transition-all flex-1 basis-[45%] sm:basis-auto shrink-0 ${
                    activeTab === "h2h"
                      ? "bg-white text-rose-700 shadow-md scale-100"
                      : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                  }`}
                >
                  <Swords className="w-4 h-4" /> H2H
                </button>
                {session && ownProfile && (
                  <button
                    onClick={() => setActiveTab("network")}
                    className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-black transition-all flex-1 basis-[45%] sm:basis-auto shrink-0 ${
                      activeTab === "network"
                        ? "bg-white text-violet-700 shadow-md scale-100"
                        : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                    }`}
                  >
                    <Heart className="w-4 h-4" /> Network
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Auth banner */}
        {renderAuthBanner()}

        {activeTab === "h2h" ? (
          <div className="mt-8">
            <H2HSection />
          </div>
        ) : activeTab === "network" ? (
          <div className="space-y-10">
            {/* Buddies section */}
            <div>
              <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-5 flex items-center gap-2">
                <Heart className="w-4 h-4 text-violet-500" /> My Buddies ({myBuddyIds.size})
              </h2>
              {myBuddyIds.size === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Heart className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium text-sm">No buddies yet. Add some from the Directory!</p>
                </div>
              ) : (() => {
                const buddyPlayers = players.filter((p) => myBuddyIds.has(p.id));
                const ltp = buddyPlayers.filter((p) => (p as any).is_looking_to_play);
                const others = buddyPlayers.filter((p) => !(p as any).is_looking_to_play);
                return (
                  <div className="space-y-6">
                    {ltp.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
                            <Activity className="w-3.5 h-3.5" /> Looking to Play
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {ltp.map((player) => (
                            <div
                              key={player.id}
                              className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition shadow-sm"
                              onClick={() => setLocation(`/player/${player.id}`)}
                            >
                              <div className="relative shrink-0">
                                {player.avatar_url ? (
                                  <img src={player.avatar_url} className="w-12 h-12 rounded-full object-cover" />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-black text-lg">
                                    {player.full_name[0]}
                                  </div>
                                )}
                                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{player.full_name}</p>
                                <p className="text-xs text-slate-400 truncate">{player.department}</p>
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">ELO {player.elo_rating ?? "—"}</p>
                              </div>
                              {ownProfile && (
                                <button
                                  className="ml-auto shrink-0 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOpponentId(player.id);
                                    setIsLogMatchOpen(true);
                                  }}
                                >
                                  <Sword className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {others.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider">
                            <UserCheck className="w-3.5 h-3.5" /> Resting / Other
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {others.map((player) => (
                            <div
                              key={player.id}
                              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition shadow-sm"
                              onClick={() => setLocation(`/player/${player.id}`)}
                            >
                              <div className="relative shrink-0">
                                {player.avatar_url ? (
                                  <img src={player.avatar_url} className="w-12 h-12 rounded-full object-cover" />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-black text-lg">
                                    {player.full_name[0]}
                                  </div>
                                )}
                                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-400 border-2 border-white dark:border-slate-900" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{player.full_name}</p>
                                <p className="text-xs text-slate-400 truncate">{player.department}</p>
                                <p className="text-xs font-bold text-slate-500 mt-0.5">ELO {player.elo_rating ?? "—"}</p>
                              </div>
                              {ownProfile && (
                                <button
                                  className="ml-auto shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOpponentId(player.id);
                                    setIsLogMatchOpen(true);
                                  }}
                                >
                                  <Sword className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Following section */}
            <div>
              <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-5 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-violet-500" /> My Following ({followingIds.size})
              </h2>
              {followingIds.size === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                  <UserCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium text-sm">You aren't following anyone yet. Find some players!</p>
                </div>
              ) : (() => {
                const followingPlayers = players.filter((p) => followingIds.has(p.id));
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {followingPlayers.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        isOwn={false}
                        isAdmin={isAdmin}
                        onDelete={handleAdminDelete}
                        onEdit={handleAdminEdit}
                        onLogMatch={
                          ownProfile
                            ? () => {
                                setSelectedOpponentId(player.id);
                                setIsLogMatchOpen(true);
                              }
                            : undefined
                        }
                        isBuddy={myBuddyIds.has(player.id)}
                        hasReceivedRequest={myBuddyRequests.has(player.id)}
                        hasSentRequest={((player as any).buddy_requests || []).includes(ownProfile?.id)}
                        onBuddyAction={ownProfile ? handleBuddyAction : undefined}
                        isFollowing={followingIds.has(player.id)}
                        onToggleFollow={ownProfile ? handleToggleFollow : undefined}
                        currentUserName={ownProfile?.full_name}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Followers section */}
            <div>
              <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-5 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> My Followers ({followers.length})
              </h2>
              {followers.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                  <UserCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium text-sm">No followers yet. Keep playing!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {followers.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      isOwn={false}
                      isAdmin={isAdmin}
                      onDelete={handleAdminDelete}
                      onEdit={handleAdminEdit}
                      onLogMatch={
                        ownProfile
                          ? () => {
                              setSelectedOpponentId(player.id);
                              setIsLogMatchOpen(true);
                            }
                          : undefined
                      }
                      isBuddy={myBuddyIds.has(player.id)}
                      hasReceivedRequest={myBuddyRequests.has(player.id)}
                      hasSentRequest={((player as any).buddy_requests || []).includes(ownProfile?.id)}
                      onBuddyAction={ownProfile ? handleBuddyAction : undefined}
                      isFollowing={followingIds.has(player.id)}
                      onToggleFollow={ownProfile ? handleToggleFollow : undefined}
                      currentUserName={ownProfile?.full_name}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pending buddy requests (received) */}
            {ownProfile && (() => {
              const pendingPlayers = players.filter(p => myBuddyRequests.has(p.id));
              return (
                <div>
                  <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-5 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-emerald-500" /> Pending Buddy Requests ({pendingPlayers.length})
                  </h2>
                  {pendingPlayers.length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                      <Heart className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500 font-medium text-sm">No pending requests.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {pendingPlayers.map(player => (
                        <div key={player.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl px-4 py-3 shadow-sm">
                          <div
                            className="shrink-0 w-10 h-10 rounded-full overflow-hidden cursor-pointer"
                            onClick={() => setLocation(`/player/${player.id}`)}
                          >
                            {player.avatar_url ? (
                              <img src={player.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-black text-base">
                                {player.full_name[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setLocation(`/player/${player.id}`)}>
                            <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{player.full_name}</p>
                            <p className="text-xs text-slate-400 truncate">{player.department} · ELO {player.elo_rating ?? "—"}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleBuddyAction(player.id, 'accept')}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => {
                                const currentRequests = ((ownProfile as any).buddy_requests || []).filter((id: string) => id !== player.id);
                                supabase.from('players').update({ buddy_requests: currentRequests }).eq('id', ownProfile.id).then(({ error }) => {
                                  if (!error) setOwnProfile((prev: any) => prev ? { ...prev, buddy_requests: currentRequests } : prev);
                                });
                              }}
                              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Sent buddy requests */}
            {ownProfile && (() => {
              const sentPlayers = players.filter(p =>
                !myBuddyIds.has(p.id) &&
                !myBuddyRequests.has(p.id) &&
                ((p as any).buddy_requests || []).includes(ownProfile.id)
              );
              return (
                <div>
                  <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-5 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-amber-500" /> Sent Buddy Requests ({sentPlayers.length})
                  </h2>
                  {sentPlayers.length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                      <Heart className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500 font-medium text-sm">No sent requests pending.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {sentPlayers.map(player => (
                        <div key={player.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/50 rounded-2xl px-4 py-3 shadow-sm">
                          <div
                            className="shrink-0 w-10 h-10 rounded-full overflow-hidden cursor-pointer"
                            onClick={() => setLocation(`/player/${player.id}`)}
                          >
                            {player.avatar_url ? (
                              <img src={player.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-base">
                                {player.full_name[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setLocation(`/player/${player.id}`)}>
                            <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{player.full_name}</p>
                            <p className="text-xs text-slate-400 truncate">{player.department} · ELO {player.elo_rating ?? "—"}</p>
                          </div>
                          <button
                            onClick={() => handleBuddyAction(player.id, 'cancel')}
                            className="shrink-0 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-xl transition border border-amber-200 dark:border-amber-800/50"
                          >
                            Cancel
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : activeTab === "directory" ? (
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
                  ${
                    showFilters
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
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Playing Level
                        </label>
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
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Department
                        </label>
                        <select
                          value={departmentFilter}
                          onChange={(e) => setDepartmentFilter(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                        >
                          <option value="All">All Departments</option>
                          {allDepartments.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>
                      {(levelFilter !== "All" ||
                        departmentFilter !== "All") && (
                        <div className="sm:col-span-2 flex justify-end">
                          <button
                            onClick={() => {
                              setLevelFilter("All");
                              setDepartmentFilter("All");
                            }}
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
              {(searchQuery ||
                levelFilter !== "All" ||
                departmentFilter !== "All") && (
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Showing{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {filteredPlayers.length}
                  </span>{" "}
                  of {otherPlayers.length} players
                </p>
              )}
            </div>

            {/* Recommended Opponents (Matchmaking) */}
            {!loading &&
              ownProfile &&
              activeTab === "directory" &&
              (function () {
                const buddiesLooking = players.filter(
                  (p) =>
                    (ownProfile as any).buddies?.includes(p.id) &&
                    p.status === "looking",
                );

                const recommended = players
                  .filter(
                    (p) =>
                      p.id !== ownProfile.id &&
                      p.status === "looking" &&
                      Math.abs(
                        (p.elo_rating || 1200) -
                          (ownProfile.elo_rating || 1200),
                      ) <= 150,
                  )
                  .slice(0, 4);

                if (recommended.length === 0) return null;

                return (
                  <div className="mb-10">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                        <Sword className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                          Recommended Matches
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Players with similar skill looking to play right now
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recommended.map((player) => (
                        <PlayerCard
                          key={"rec-" + player.id}
                          player={player}
                          isOwn={false}
                          isAdmin={isAdmin}
                          onDelete={handleAdminDelete}
                          onEdit={handleAdminEdit}
                          onLogMatch={
                            ownProfile
                              ? () => {
                                  setSelectedOpponentId(player.id);
                                  setIsLogMatchOpen(true);
                                }
                              : undefined
                          }
                          isBuddy={myBuddyIds.has(player.id)}
                          hasReceivedRequest={myBuddyRequests.has(player.id)}
                          hasSentRequest={((player as any).buddy_requests || []).includes(ownProfile?.id)}
                          onBuddyAction={ownProfile ? handleBuddyAction : undefined}
                          isFollowing={followingIds.has(player.id)}
                          onToggleFollow={ownProfile ? handleToggleFollow : undefined}
                          currentUserName={ownProfile?.full_name}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

            {/* Directory grid (others) */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="h-56 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col p-5"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-full shimmer shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-full rounded shimmer" />
                        <div className="h-3 w-2/3 rounded shimmer" />
                      </div>
                    </div>
                    <div className="space-y-3 mt-auto">
                      <div className="h-3 w-1/2 rounded shimmer" />
                      <div className="h-8 w-full rounded-xl shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
                <p className="text-slate-700 dark:text-slate-300 font-bold">
                  {isSupabaseConfigured
                    ? "No connection to server"
                    : "Player directory is not configured"}
                </p>
                <p className="text-slate-400 text-sm max-w-md">
                  {isSupabaseConfigured
                    ? "This app requires internet to load player data."
                    : "The deployed site is missing Supabase environment variables."}
                </p>
                <button
                  onClick={() => fetchPlayers()}
                  className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition"
                >
                  Retry
                </button>
              </div>
            ) : filteredPlayers.length > 0 ? (
              <>
                {searchQuery ||
                levelFilter !== "All" ||
                departmentFilter !== "All" ? null : (
                  <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" /> All Members
                  </h2>
                )}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 md:grid-cols-2 gap-3"
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
                        onLogMatch={
                          ownProfile
                            ? () => {
                                setSelectedOpponentId(player.id);
                                setIsLogMatchOpen(true);
                              }
                            : undefined
                        }
                        isBuddy={myBuddyIds.has(player.id)}
                        hasReceivedRequest={myBuddyRequests.has(player.id)}
                        hasSentRequest={((player as any).buddy_requests || []).includes(ownProfile?.id)}
                        onBuddyAction={ownProfile ? handleBuddyAction : undefined}
                        isFollowing={followingIds.has(player.id)}
                        onToggleFollow={ownProfile ? handleToggleFollow : undefined}
                        currentUserName={ownProfile?.full_name}
                      />
                    </motion.div>
                  ))}
                </motion.div>

                {visibleCount < filteredPlayers.length && (
                  <div className="mt-12 flex justify-center">
                    <button
                      onClick={() => setVisibleCount((v) => v + 24)}
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
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                  No players found
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 text-sm">
                  Try adjusting your search or filters.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setLevelFilter("All");
                    setDepartmentFilter("All");
                  }}
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
