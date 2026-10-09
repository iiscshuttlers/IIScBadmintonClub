import { useState, useEffect, useMemo } from "react";
import { X, Shield, Crown, Users, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface TeamRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: {
    id: string;
    name: string;
    short_name?: string | null;
    pool?: string | null;
    captain_id?: string | null;
  } | null;
  tournamentId?: string;
}

interface TeamMemberItem {
  id: string;
  player_id: string;
  role: string;
  is_captain: boolean;
  gender: "Male" | "Female";
  player: {
    id: string;
    full_name: string;
    email?: string | null;
    gender?: string | null;
    is_guest?: boolean | null;
    avatar_url?: string | null;
    elo_rating?: number | null;
  };
}

// Smart gender resolver with fallback heuristics for guest rosters
export function resolveMemberGender(gender?: string | null, name?: string): "Male" | "Female" {
  if (gender) {
    const g = gender.trim().toLowerCase();
    if (g.startsWith("f") || g === "female" || g === "w" || g === "women") return "Female";
    if (g.startsWith("m") || g === "male") return "Male";
  }
  if (name) {
    const clean = name.toLowerCase().replace(/\s*\(guest\)\s*/i, "").trim();
    const firstName = clean.split(" ")[0];
    const femaleNames = new Set([
      "alice", "priya", "sara", "sarah", "neha", "kavya", "ananya", "pooja", 
      "sneha", "ritu", "radhika", "ushnaa", "jefrin", "divya", "swati", "tanvi",
      "deepa", "meera", "nisha", "riya", "shreya", "sharmitha", "megha", "aditi",
      "sakshi", "aishwarya", "anjali", "sunita", "rekha", "parvathi", "lakshmi"
    ]);
    if (femaleNames.has(firstName)) return "Female";
  }
  return "Male";
}

export function TeamRosterModal({ isOpen, onClose, team, tournamentId }: TeamRosterModalProps) {
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<"ALL" | "Male" | "Female">("ALL");

  useEffect(() => {
    if (!isOpen || !team?.id) {
      setMembers([]);
      return;
    }

    let isMounted = true;
    async function loadRoster() {
      setLoading(true);
      try {
        // 1. Fetch team record to verify captain_id
        const { data: teamRec } = await supabase
          .from("tournament_teams")
          .select("id, name, short_name, pool, captain_id")
          .eq("id", team!.id)
          .maybeSingle();

        const captainId = teamRec?.captain_id || team!.captain_id;

        // 2. Fetch team members with joined player info
        const { data: rawMembers } = await supabase
          .from("tournament_team_members")
          .select("id, player_id, role, status, player:players!player_id(id, full_name, email, gender, is_guest, avatar_url, elo_rating)")
          .eq("team_id", team!.id)
          .eq("status", "ACTIVE");

        const list: TeamMemberItem[] = (rawMembers || [])
          .filter((m: any) => m.player)
          .map((m: any) => {
            const isCap = m.role === "CAPTAIN" || m.player_id === captainId;
            const resolvedGender = resolveMemberGender(m.player.gender, m.player.full_name);
            return {
              id: m.id,
              player_id: m.player_id,
              role: isCap ? "CAPTAIN" : m.role || "PLAYER",
              is_captain: isCap,
              gender: resolvedGender,
              player: m.player
            };
          });

        // 3. If captain is designated on team but not present in tournament_team_members list, fetch and prepend captain
        if (captainId && !list.some(m => m.player_id === captainId)) {
          const { data: captainPlayer } = await supabase
            .from("players")
            .select("id, full_name, email, gender, is_guest, avatar_url, elo_rating")
            .eq("id", captainId)
            .maybeSingle();

          if (captainPlayer) {
            list.unshift({
              id: `captain-${captainPlayer.id}`,
              player_id: captainPlayer.id,
              role: "CAPTAIN",
              is_captain: true,
              gender: resolveMemberGender(captainPlayer.gender, captainPlayer.full_name),
              player: captainPlayer
            });
          }
        }

        // 4. Sort: Captain ALWAYS first, then alphabetical by player name
        list.sort((a, b) => {
          if (a.is_captain && !b.is_captain) return -1;
          if (!a.is_captain && b.is_captain) return 1;
          return a.player.full_name.localeCompare(b.player.full_name);
        });

        if (isMounted) {
          setMembers(list);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load team roster:", err);
        if (isMounted) setLoading(false);
      }
    }

    loadRoster();

    return () => {
      isMounted = false;
    };
  }, [isOpen, team?.id, team?.captain_id]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const counts = useMemo(() => {
    const m = members.filter(i => i.gender === "Male").length;
    const f = members.filter(i => i.gender === "Female").length;
    return { male: m, female: f, total: members.length };
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (genderFilter === "ALL") return members;
    return members.filter(m => m.gender === genderFilter);
  }, [members, genderFilter]);

  if (!isOpen || !team) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="max-w-md w-full max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                    {team.name}
                  </h2>
                  {team.short_name && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {team.short_name}
                    </span>
                  )}
                </div>
                {team.pool && (
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                    Pool {team.pool} · Team Roster
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Legend & Gender Filter Chips */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setGenderFilter("ALL")}
                className={`text-xs font-bold px-3 py-1 rounded-full transition-all ${
                  genderFilter === "ALL"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                All ({counts.total})
              </button>
              <button
                onClick={() => setGenderFilter("Male")}
                className={`text-xs font-bold px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                  genderFilter === "Male"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 border border-sky-200 dark:border-sky-800/40"
                }`}
              >
                <span>♂ Male</span>
                <span className="opacity-80">({counts.male})</span>
              </button>
              <button
                onClick={() => setGenderFilter("Female")}
                className={`text-xs font-bold px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                  genderFilter === "Female"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-800/40"
                }`}
              >
                <span>♀ Female</span>
                <span className="opacity-80">({counts.female})</span>
              </button>
            </div>
            
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              {counts.total} Players
            </div>
          </div>
        </div>

        {/* Scrollable Members List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5 max-h-[60vh] divide-y-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Team Roster...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                {genderFilter !== "ALL" ? `No ${genderFilter} players found` : "No players in this team yet"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Players can be added via the Tournament Admin panel.</p>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isFemale = member.gender === "Female";
              const isCaptain = member.is_captain;

              return (
                <div
                  key={member.id}
                  className={`relative p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-between gap-3 ${
                    isCaptain
                      ? "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-2 border-amber-400 dark:border-amber-500/60 shadow-sm"
                      : isFemale
                      ? "bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 hover:border-rose-300"
                      : "bg-sky-50/40 dark:bg-sky-950/20 border border-sky-200/80 dark:border-sky-900/40 hover:border-sky-300"
                  }`}
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                        isCaptain
                          ? "bg-amber-500 text-slate-950 ring-2 ring-amber-400/50"
                          : isFemale
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 ring-2 ring-rose-300/40"
                          : "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 ring-2 ring-sky-300/40"
                      }`}
                    >
                      {isCaptain ? (
                        <Crown className="w-5 h-5 fill-current" />
                      ) : (
                        member.player.full_name.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Name & Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {member.player.full_name}
                        </span>
                        {isCaptain && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow-xs">
                            <Crown className="w-3 h-3 fill-current" />
                            Captain
                          </span>
                        )}
                      </div>
                      
                      {member.player.email && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {member.player.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Gender Pill Badge */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isFemale ? (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800 shadow-2xs">
                        <span>♀</span>
                        <span>Female</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-300/60 dark:border-sky-800 shadow-2xs">
                        <span>♂</span>
                        <span>Male</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 hover:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs rounded-full transition shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
