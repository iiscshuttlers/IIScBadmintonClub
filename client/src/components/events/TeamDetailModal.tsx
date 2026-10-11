import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Shield, 
  Crown, 
  Users, 
  Loader2, 
  Swords, 
  Radio, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Trophy,
  Activity
} from "lucide-react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { resolveMemberGender } from "@/components/events/TeamRosterModal";

export interface TeamDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: {
    id: string;
    name: string;
    short_name?: string | null;
    pool?: string | null;
    captain_id?: string | null;
    tournament_id?: string | null;
    logo_url?: string | null;
  } | null;
  tournamentId?: string;
  initialTab?: "roster" | "matches";
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

interface TieMatchItem {
  id: string;
  tie_id: string;
  match_code: string;
  category: string;
  rubber_order: number;
  rubber_label: string;
  playing_order?: number | null;
  status: string;
  winner_team?: string | null;
  set1_team1?: number | null;
  set1_team2?: number | null;
  set2_team1?: number | null;
  set2_team2?: number | null;
  set3_team1?: number | null;
  set3_team2?: number | null;
  player1?: { full_name: string } | null;
  player2?: { full_name: string } | null;
  player3?: { full_name: string } | null;
  player4?: { full_name: string } | null;
}

interface TeamTieItem {
  id: string;
  tie_code: string;
  round_name: string;
  stage: string;
  state: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  score_team_a: number;
  score_team_b: number;
  winner_team_id?: string | null;
  created_at?: string;
  team_a: { id: string; name: string; short_name?: string | null; logo_url?: string | null };
  team_b: { id: string; name: string; short_name?: string | null; logo_url?: string | null };
  rubbers?: TieMatchItem[];
}

export function TeamDetailModal({ 
  isOpen, 
  onClose, 
  team, 
  tournamentId,
  initialTab = "roster" 
}: TeamDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"roster" | "matches">(initialTab);
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [ties, setTies] = useState<TeamTieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<"ALL" | "Male" | "Female">("ALL");

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || !team?.id) {
      setMembers([]);
      setTies([]);
      return;
    }

    let isMounted = true;
    async function loadTeamData() {
      setLoading(true);
      try {
        // 1. Fetch team record to verify captain_id and details
        const { data: teamRec } = await supabase
          .from("tournament_teams")
          .select("id, name, short_name, pool, captain_id, tournament_id, logo_url")
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

        // Sort: Captain ALWAYS first, then alphabetical
        list.sort((a, b) => {
          if (a.is_captain && !b.is_captain) return -1;
          if (!a.is_captain && b.is_captain) return 1;
          return a.player.full_name.localeCompare(b.player.full_name);
        });

        // 4. Fetch ties involving this team
        const { data: rawTies } = await supabase
          .from("tournament_ties")
          .select(`
            id,
            tie_code,
            round_name,
            stage,
            state,
            score_team_a,
            score_team_b,
            winner_team_id,
            created_at,
            team_a:tournament_teams!tournament_ties_team_a_id_fkey(id, name, short_name, logo_url),
            team_b:tournament_teams!tournament_ties_team_b_id_fkey(id, name, short_name, logo_url)
          `)
          .or(`team_a_id.eq.${team!.id},team_b_id.eq.${team!.id}`)
          .order("created_at", { ascending: true });

        const formattedTies: TeamTieItem[] = (rawTies || []) as any;

        // Fetch rubbers for these ties if any exist
        if (formattedTies.length > 0) {
          const tieIds = formattedTies.map(t => t.id);
          const { data: rawRubbers } = await supabase
            .from("tournament_matches")
            .select(`
              id,
              tie_id,
              match_code,
              category,
              rubber_order,
              rubber_label,
              playing_order,
              status,
              winner_team,
              set1_team1, set1_team2,
              set2_team1, set2_team2,
              set3_team1, set3_team2,
              player1:players!tournament_matches_player1_id_fkey(full_name),
              player2:players!tournament_matches_player2_id_fkey(full_name),
              player3:players!tournament_matches_player3_id_fkey(full_name),
              player4:players!tournament_matches_player4_id_fkey(full_name)
            `)
            .in("tie_id", tieIds);

          const rubbersByTie = new Map<string, TieMatchItem[]>();
          (rawRubbers || []).forEach((r: any) => {
            if (!rubbersByTie.has(r.tie_id)) rubbersByTie.set(r.tie_id, []);
            rubbersByTie.get(r.tie_id)!.push(r);
          });

          formattedTies.forEach(t => {
            const rList = rubbersByTie.get(t.id) || [];
            rList.sort((a, b) => (a.playing_order ?? a.rubber_order) - (b.playing_order ?? b.rubber_order));
            t.rubbers = rList;
          });
        }

        if (isMounted) {
          setMembers(list);
          setTies(formattedTies);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load team details:", err);
        if (isMounted) setLoading(false);
      }
    }

    loadTeamData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, team?.id]);

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

  // Categorize matches: Live first, Upcoming next, Completed last
  const categorizedMatches = useMemo(() => {
    const live: TeamTieItem[] = [];
    const upcoming: TeamTieItem[] = [];
    const completed: TeamTieItem[] = [];

    ties.forEach(t => {
      if (t.state === 'IN_PROGRESS') {
        live.push(t);
      } else if (t.state === 'COMPLETED') {
        completed.push(t);
      } else {
        upcoming.push(t);
      }
    });

    return { live, upcoming, completed, total: ties.length };
  }, [ties]);

  if (!isOpen || !team) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="max-w-2xl w-full max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Hero */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {team.logo_url ? (
                <img 
                  src={team.logo_url} 
                  alt={team.name} 
                  className="w-13 h-13 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0" 
                />
              ) : (
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary border border-primary/30 flex items-center justify-center shrink-0 shadow-inner">
                  <Shield className="w-7 h-7" />
                </div>
              )}
              
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight truncate">
                    {team.name}
                  </h2>
                  {team.short_name && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {team.short_name}
                    </span>
                  )}
                  {team.pool && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                      Pool {team.pool}
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                  <span>{counts.total} Registered Players</span>
                  <span>•</span>
                  <span>{categorizedMatches.total} Tournament Fixtures</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/team-hub/${team.id}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-slate-200 dark:border-slate-700"
                  title="Open Team Hub to manage team, rosters and lineups"
                >
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Team Hub</span>
                </button>
              </Link>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs (Squad Roster vs Fixtures/Matches) */}
          <div className="mt-4 flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("roster")}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-black transition-all border-b-2 -mb-px ${
                activeTab === "roster"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4" />
              Squad Roster ({counts.total})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("matches")}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-black transition-all border-b-2 -mb-px ${
                activeTab === "matches"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <Swords className="w-4 h-4" />
              Fixtures & Matches ({categorizedMatches.total})
              {categorizedMatches.live.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: Squad Roster */}
        {activeTab === "roster" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Quick Filter Bar */}
            <div className="p-3 sm:px-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
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
                {filteredMembers.length} displayed
              </div>
            </div>

            {/* Scrollable Members List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Squad...</p>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                    {genderFilter !== "ALL" ? `No ${genderFilter} players found` : "No players registered in this team yet"}
                  </p>
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
                      <div className="flex items-center gap-3.5 min-w-0">
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
                          ) : member.player.avatar_url ? (
                            <img src={member.player.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                          ) : (
                            member.player.full_name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {member.player.full_name}
                            </span>
                            {isCaptain && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow-xs">
                                <Crown className="w-3 h-3 fill-current" />
                                Captain
                              </span>
                            )}
                            {member.player.is_guest && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                Guest
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {member.player.elo_rating && (
                              <span>Rating: <strong className="text-slate-700 dark:text-slate-300">{member.player.elo_rating}</strong></span>
                            )}
                            {member.player.email && (
                              <span className="truncate opacity-75">{member.player.email}</span>
                            )}
                          </div>
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
          </div>
        )}

        {/* Tab 2: Team Matches & Ties (Live first, Upcoming next, Completed last) */}
        {activeTab === "matches" && (
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Fixtures...</p>
              </div>
            ) : categorizedMatches.total === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No fixtures scheduled for this team yet</p>
                <p className="text-xs text-slate-400 mt-1">Fixtures will appear once the tournament schedule is generated.</p>
              </div>
            ) : (
              <>
                {/* 1. LIVE MATCHES (FIRST) */}
                {categorizedMatches.live.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <Radio className="w-4 h-4 animate-pulse" />
                      <h3 className="text-xs font-black uppercase tracking-wider">
                        Live on Court ({categorizedMatches.live.length})
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {categorizedMatches.live.map((tie) => (
                        <TieMatchCard key={tie.id} tie={tie} currentTeamId={team.id} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. UPCOMING MATCHES (NEXT) */}
                {categorizedMatches.upcoming.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <Clock className="w-4 h-4" />
                      <h3 className="text-xs font-black uppercase tracking-wider">
                        Upcoming Fixtures ({categorizedMatches.upcoming.length})
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {categorizedMatches.upcoming.map((tie) => (
                        <TieMatchCard key={tie.id} tie={tie} currentTeamId={team.id} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. COMPLETED MATCHES (LAST) */}
                {categorizedMatches.completed.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <CheckCircle2 className="w-4 h-4" />
                      <h3 className="text-xs font-black uppercase tracking-wider">
                        Completed Results ({categorizedMatches.completed.length})
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {categorizedMatches.completed.map((tie) => (
                        <TieMatchCard key={tie.id} tie={tie} currentTeamId={team.id} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
          <span className="text-[11px] font-bold text-slate-400">
            {team.pool ? `Pool ${team.pool}` : "IISc Badminton Tournament"}
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 hover:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs rounded-full transition shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Single Tie Match Card inside the team modal
function TieMatchCard({ tie, currentTeamId }: { tie: TeamTieItem; currentTeamId: string }) {
  const isTeamA = tie.team_a?.id === currentTeamId;
  const opponent = isTeamA ? tie.team_b : tie.team_a;
  const currentTeam = isTeamA ? tie.team_a : tie.team_b;
  const myScore = isTeamA ? tie.score_team_a : tie.score_team_b;
  const oppScore = isTeamA ? tie.score_team_b : tie.score_team_a;

  const isLive = tie.state === 'IN_PROGRESS';
  const isCompleted = tie.state === 'COMPLETED';
  const isWin = isCompleted && tie.winner_team_id === currentTeamId;
  const isLoss = isCompleted && tie.winner_team_id && tie.winner_team_id !== currentTeamId;
  const isDraw = isCompleted && !tie.winner_team_id;

  const [expanded, setExpanded] = useState(isLive);

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isLive
        ? "bg-rose-50/20 dark:bg-rose-950/20 border-rose-400/40 shadow-sm"
        : isCompleted
        ? isWin
          ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-400/30"
          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
        : "bg-slate-50/60 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800"
    }`}>
      <div className="flex items-center justify-between gap-3">
        {/* Stage & Round Info */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {tie.tie_code}
          </span>
          <span className="text-xs font-bold text-slate-500 uppercase">
            {tie.round_name || tie.stage}
          </span>
        </div>

        {/* State / Result Badge */}
        <div>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
              <Radio className="w-3 h-3" /> LIVE NOW
            </span>
          ) : isCompleted ? (
            isWin ? (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                WON ({myScore} - {oppScore})
              </span>
            ) : isLoss ? (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30">
                LOST ({myScore} - {oppScore})
              </span>
            ) : (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                DRAW ({myScore} - {oppScore})
              </span>
            )
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-500">
              SCHEDULED
            </span>
          )}
        </div>
      </div>

      {/* Opponent & Matchup */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xs font-bold text-slate-400">vs</div>
          <div>
            <h4 className="font-black text-sm text-slate-900 dark:text-white">
              {opponent?.name || "TBD / BYE"}
            </h4>
            {opponent?.short_name && (
              <span className="text-[10px] font-bold text-slate-400">
                {opponent.short_name}
              </span>
            )}
          </div>
        </div>

        {/* Tie Score */}
        <div className="text-right">
          <div className="text-base font-black tracking-tight text-slate-900 dark:text-white">
            <span className={isWin ? "text-emerald-500" : ""}>{myScore}</span>
            <span className="mx-1 text-slate-400">-</span>
            <span className={isLoss ? "text-rose-500" : ""}>{oppScore}</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Tie Score</span>
        </div>
      </div>

      {/* Rubber Matches details toggle */}
      {tie.rubbers && tie.rubbers.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <span>Rubbers Breakdown ({tie.rubbers.length} Matches)</span>
            <span className="text-[11px] text-primary">{expanded ? "Hide ▲" : "View Rubbers ▼"}</span>
          </button>

          {expanded && (
            <div className="mt-2.5 space-y-2">
              {tie.rubbers.map((rubber) => {
                const s1 = rubber.set1_team1 !== null ? `${rubber.set1_team1}-${rubber.set1_team2}` : null;
                const s2 = rubber.set2_team1 !== null ? `${rubber.set2_team1}-${rubber.set2_team2}` : null;
                const s3 = rubber.set3_team1 !== null ? `${rubber.set3_team1}-${rubber.set3_team2}` : null;
                const scoreStr = [s1, s2, s3].filter(Boolean).join(", ");

                return (
                  <div 
                    key={rubber.id} 
                    className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {rubber.category}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {rubber.rubber_label || `Rubber #${rubber.rubber_order}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {scoreStr ? (
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {scoreStr}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 uppercase">
                          {rubber.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
