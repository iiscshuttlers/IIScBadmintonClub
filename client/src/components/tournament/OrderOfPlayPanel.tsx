import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import type { TournamentThemeInput } from "@/lib/tournamentTheme";
import { toLocalDateTimeInput, localDateTimeInputToIso } from "@/lib/umpire/schedule";
import { findRestConflicts, playerSideLabel } from "@/lib/restConflicts";
import {
  findCourtConflicts,
  suggestAlternativeSlots,
  type UnavailableCourtPeriod,
} from "@/lib/courtConflicts";
import { tournamentService } from "@/services/tournamentService";
import {
  Loader2, CalendarClock, MapPin, Clock, Check, Swords, LayoutGrid,
  RefreshCw, AlertTriangle, Radio, ShieldAlert, Sparkles, X,
} from "lucide-react";

const CAT_LABELS: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles", MD: "Men's Doubles",
  WD: "Women's Doubles", XD: "Mixed Doubles", BS: "Boys' Singles",
  GS: "Girls' Singles", BD: "Boys' Doubles", GD: "Girls' Doubles",
};

interface MatchRow {
  id: string;
  match_code: string;
  category: string;
  round_name: string;
  round: number;
  match_number: number;
  team1_label: string | null;
  team2_label: string | null;
  player1_id: string | null;
  player2_id?: string | null;
  player3_id?: string | null;
  player4_id?: string | null;
  court_number: string | null;
  scheduled_at: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  status: string;
  tie_id?: string | null;
  is_tie?: boolean;
}

interface OrderOfPlayProps extends TournamentThemeInput {
  id: string;
  format_family?: string;
  min_rest_minutes?: number | null;
  estimated_match_minutes?: number | null;
  unavailable_court_periods?: UnavailableCourtPeriod[] | null;
}

export function OrderOfPlayPanel({ tournament }: { tournament: OrderOfPlayProps }) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState("ALL");
  const [viewScope, setViewScope] = useState<"ALL" | "TIES" | "RUBBERS">("ALL");
  const [edits, setEdits] = useState<Record<string, { court: string; time: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [tournamentPolicy, setTournamentPolicy] = useState<{
    min_rest_minutes: number;
    estimated_match_minutes: number;
    unavailable_court_periods: UnavailableCourtPeriod[];
  }>({
    min_rest_minutes: tournament.min_rest_minutes ?? 15,
    estimated_match_minutes: tournament.estimated_match_minutes ?? 30,
    unavailable_court_periods: (tournament.unavailable_court_periods as any) ?? [],
  });

  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    match: MatchRow;
    court: string;
    isoTime: string;
    warningMessage: string;
    conflictType: string;
    conflictingId?: string;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    const [matchesRes, tiesRes, tourRes] = await Promise.all([
      supabase
        .from("tournament_matches")
        .select("id, match_code, category, round_name, round, match_number, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id, court_number, scheduled_at, started_at, ended_at, status, tie_id")
        .eq("tournament_id", tournament.id)
        .order("round", { ascending: true })
        .order("match_number", { ascending: true }),
      supabase
        .from("tournament_ties")
        .select(`
          id, tie_code, stage, round_name, round_number, state, scheduled_at,
          team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name),
          team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name)
        `)
        .eq("tournament_id", tournament.id)
        .neq("state", "COMPLETED")
        .order("round_number", { ascending: true }),
      supabase
        .from("tournaments")
        .select("min_rest_minutes, estimated_match_minutes, unavailable_court_periods")
        .eq("id", tournament.id)
        .maybeSingle(),
    ]);

    if (tourRes.data) {
      setTournamentPolicy({
        min_rest_minutes: tourRes.data.min_rest_minutes ?? 15,
        estimated_match_minutes: tourRes.data.estimated_match_minutes ?? 30,
        unavailable_court_periods: (tourRes.data.unavailable_court_periods as any) ?? [],
      });
    }

    if (matchesRes.error && tiesRes.error) {
      if (!silent) toast.error(matchesRes.error.message || tiesRes.error.message);
      setLoadError(true);
      setLoading(false);
      return;
    }

    const matchRows: MatchRow[] = ((matchesRes.data as any) ?? []).map((m: any) => ({
      ...m,
      is_tie: false,
    }));

    // Also map ties as schedule items
    const tieRows: MatchRow[] = ((tiesRes.data as any) ?? []).map((t: any) => {
      // Find if any rubbers under this tie already have a court assigned
      const rubbersForTie = matchRows.filter((m) => m.tie_id === t.id);
      const rubberCourt = rubbersForTie.find((r) => !!r.court_number)?.court_number || null;

      return {
        id: t.id,
        match_code: t.tie_code,
        category: t.stage || "TEAM TIE",
        round_name: t.round_name || `Round ${t.round_number || 1}`,
        round: t.round_number || 1,
        match_number: 1,
        team1_label: t.team_a?.short_name || t.team_a?.name || "TBD",
        team2_label: t.team_b?.short_name || t.team_b?.name || "TBD",
        player1_id: t.team_a ? "assigned" : null,
        court_number: rubberCourt,
        scheduled_at: t.scheduled_at,
        status: t.state === "IN_PROGRESS" ? "in_progress" : "scheduled",
        tie_id: t.id,
        is_tie: true,
      };
    });

    // Combine ties and rubbers
    const combined = [...tieRows, ...matchRows];

    setLoadError(false);
    setMatches(combined);
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`oop_matches_${tournament.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournament.id}` }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_ties", filter: `tournament_id=eq.${tournament.id}` }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tournament.id, load]);

  const categories = useMemo(() => Array.from(new Set(matches.map((m) => m.category))).sort(), [matches]);

  const hasTies = useMemo(() => matches.some((m) => m.is_tie), [matches]);
  const hasRubbers = useMemo(() => matches.some((m) => !m.is_tie), [matches]);

  const inCat = (m: MatchRow) => {
    if (viewScope === "TIES" && !m.is_tie) return false;
    if (viewScope === "RUBBERS" && m.is_tie) return false;
    return category === "ALL" || m.category === category;
  };

  const editFor = (m: MatchRow) =>
    edits[m.id] ?? { court: m.court_number ?? "", time: toLocalDateTimeInput(m.scheduled_at) };

  const setEdit = (id: string, patch: Partial<{ court: string; time: string }>) =>
    setEdits((prev) => ({ ...prev, [id]: { ...editFor(matches.find((m) => m.id === id)!), ...prev[id], ...patch } }));

  const dirty = (m: MatchRow) => {
    const e = edits[m.id];
    if (!e) return false;
    const iso = localDateTimeInputToIso(e.time);
    return (e.court.trim() || null) !== (m.court_number ?? null) || iso !== (m.scheduled_at ?? null);
  };

  const executeSave = async (m: MatchRow, court: string, iso: string | null) => {
    let error: any = null;

    if (m.is_tie) {
      // 1. Update the tie's scheduled_at
      const res = await supabase
        .from("tournament_ties")
        .update({
          scheduled_at: iso,
        })
        .eq("id", m.id);
      error = res.error;

      // 2. Also propagate court and scheduled_at to all rubbers under this tie
      if (!error && (court || iso)) {
        const rubberRes = await supabase
          .from("tournament_matches")
          .update({
            ...(court ? { court_number: court } : {}),
            ...(iso ? { scheduled_at: iso } : {}),
          } as any)
          .eq("tie_id", m.id);
        error = rubberRes.error;
      }
    } else {
      const res = await supabase
        .from("tournament_matches")
        .update({
          court_number: court || null,
          scheduled_at: iso,
          status: "scheduled",
          reminder_sent: false,
        } as any)
        .eq("id", m.id);
      error = res.error;
    }

    setSavingId(null);
    if (error) return toast.error(error.message || "Could not save");
    toast.success(`${m.is_tie ? "Tie " : ""}${m.match_code} scheduled`);
    setEdits((prev) => { const n = { ...prev }; delete n[m.id]; return n; });
    load(true);
  };

  const save = async (m: MatchRow) => {
    const e = editFor(m);
    const iso = localDateTimeInputToIso(e.time);
    setSavingId(m.id);

    const proposedCourt = e.court.trim();
    if (proposedCourt && iso) {
      const { data: currentCourtMatches, error: validationError } = await supabase
        .from("tournament_matches")
        .select("id, match_code, court_number, scheduled_at, started_at, ended_at, status, tie_id, player1_id, player2_id, player3_id, player4_id")
        .eq("tournament_id", tournament.id)
        .in("status", ["pending", "scheduled", "in_progress", "completed"]);

      if (validationError) {
        setSavingId(null);
        toast.error("Could not verify court availability. Refresh and try again.");
        return;
      }

      const candidates = ((currentCourtMatches as any[]) ?? []).filter((candidate) =>
        candidate.id !== m.id && (!m.is_tie || candidate.tie_id !== m.id),
      );
      const proposed = { ...m, court_number: proposedCourt, scheduled_at: iso };

      // 1. Check court conflicts
      const courtConflictList = findCourtConflicts([...candidates, proposed], {
        estimatedMinutes: tournamentPolicy.estimated_match_minutes,
        unavailablePeriods: tournamentPolicy.unavailable_court_periods,
      }).get(m.id);

      // 2. Check player rest conflicts
      const restConflictList = findRestConflicts([...candidates, proposed], {
        minRestMinutes: tournamentPolicy.min_rest_minutes,
        estimatedMinutes: tournamentPolicy.estimated_match_minutes,
      }).get(m.id);

      const hardCourtConflict = courtConflictList?.find((c) => c.conflictType === "hard");
      const hardRestConflict = restConflictList?.find((c) => c.conflictType === "hard");

      if (hardCourtConflict || hardRestConflict) {
        setSavingId(null);
        const description = hardCourtConflict
          ? (hardCourtConflict.timingBasis === "unavailable_period"
              ? `Court ${proposedCourt} is in an unavailable blackout period (${hardCourtConflict.reason || "Blackout"}). Hard conflicts cannot be overridden.`
              : `Court ${proposedCourt} is currently occupied by active match ${hardCourtConflict.otherCode}. Hard conflicts cannot be overridden.`)
          : `A player has completed a match less than ${tournamentPolicy.min_rest_minutes} mins ago. Hard rest conflicts cannot be overridden.`;
        toast.error("Hard Conflict Detected", { description });
        return;
      }

      const warningCourt = courtConflictList?.find((c) => c.conflictType === "warning");
      const warningRest = restConflictList?.find((c) => c.conflictType === "warning");

      if (warningCourt || warningRest) {
        setSavingId(null);
        const warningMsg = warningCourt
          ? `Court ${proposedCourt} has an estimated ${warningCourt.overlapMins}m overlap with ${warningCourt.otherCode}.`
          : `A player has only an estimated ${warningRest!.gapMins}m rest gap after ${warningRest!.previousCode} (policy is ${tournamentPolicy.min_rest_minutes}m).`;

        setOverrideModal({
          isOpen: true,
          match: m,
          court: proposedCourt,
          isoTime: iso,
          warningMessage: warningMsg,
          conflictType: warningCourt ? "court_warning" : "rest_warning",
          conflictingId: warningCourt?.otherMatchId ?? warningRest?.previousMatchId,
        });
        return;
      }
    }

    await executeSave(m, proposedCourt, iso);
  };

  const handleConfirmOverride = async () => {
    if (!overrideModal) return;
    if (!overrideReason.trim()) {
      toast.error("An audit reason is required to override schedule warnings.");
      return;
    }

    setOverriding(true);
    try {
      if (overrideModal.match.is_tie) {
        await executeSave(overrideModal.match, overrideModal.court, overrideModal.isoTime);
      } else {
        await tournamentService.overrideTournamentSchedule({
          tournamentId: tournament.id,
          matchId: overrideModal.match.id,
          court: overrideModal.court,
          scheduledAt: overrideModal.isoTime,
          reason: overrideReason.trim(),
          conflictType: overrideModal.conflictType,
          conflictingId: overrideModal.conflictingId,
        });
        toast.success(`Schedule overridden and audited for ${overrideModal.match.match_code}`);
        setEdits((prev) => { const n = { ...prev }; delete n[overrideModal.match.id]; return n; });
        load(true);
      }
      setOverrideModal(null);
      setOverrideReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to override schedule");
    } finally {
      setOverriding(false);
    }
  };

  // Unscheduled = live/scheduled matches missing a court or a time, with competitors assigned.
  const unscheduled = useMemo(
    () =>
      matches.filter(
        (m) =>
          inCat(m) &&
          m.status !== "completed" &&
          (!m.court_number || !m.scheduled_at) &&
          (!!m.player1_id || !!m.team1_label || !!m.tie_id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches, category],
  );

  // Court overview: scheduled matches grouped by court, ordered by time.
  const byCourt = useMemo(() => {
    const groups: Record<string, MatchRow[]> = {};
    matches
      .filter((m) => inCat(m) && m.court_number && m.scheduled_at && m.status !== "completed")
      .forEach((m) => { (groups[m.court_number!] ??= []).push(m); });
    Object.values(groups).forEach((arr) =>
      arr.sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()),
    );
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, category]);

  const allCourts = useMemo(() => {
    const courtsSet = new Set<string>();
    matches.forEach((m) => {
      if (m.court_number?.trim()) courtsSet.add(m.court_number.trim());
    });
    tournamentPolicy.unavailable_court_periods.forEach((p) => {
      if (p.court?.trim()) courtsSet.add(p.court.trim());
    });
    ["1", "2", "3", "4"].forEach((c) => courtsSet.add(c));
    return Array.from(courtsSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [matches, tournamentPolicy.unavailable_court_periods]);

  // Rest checks use actual completion when present, otherwise a labelled estimate.
  // Uses pending edits so the warning appears before saving.
  const restConflicts = useMemo(() => {
    const effective = matches
      .filter((m) => !m.is_tie)
      .map((m) => {
        const e = edits[m.id];
        return e ? { ...m, scheduled_at: localDateTimeInputToIso(e.time) } : m;
      });
    return findRestConflicts(effective, {
      minRestMinutes: tournamentPolicy.min_rest_minutes,
      estimatedMinutes: tournamentPolicy.estimated_match_minutes,
    });
  }, [matches, edits, tournamentPolicy]);

  const courtConflicts = useMemo(() => {
    const tieIds = new Set(matches.filter((m) => m.is_tie).map((m) => m.id));
    const effective = matches
      .filter((m) => m.is_tie || !m.tie_id || !tieIds.has(m.tie_id))
      .map((m) => {
        const e = edits[m.id];
        return e ? {
          ...m,
          court_number: e.court.trim() || null,
          scheduled_at: localDateTimeInputToIso(e.time),
        } : m;
      });
    return findCourtConflicts(effective, {
      estimatedMinutes: tournamentPolicy.estimated_match_minutes,
      unavailablePeriods: tournamentPolicy.unavailable_court_periods,
    });
  }, [matches, edits, tournamentPolicy]);

  const conflictCount = new Set([...restConflicts.keys(), ...courtConflicts.keys()]).size;

  const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm";
  const fieldCls = "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/40";

  const matchRow = (m: MatchRow, showEditor: boolean) => {
    const e = editFor(m);
    const live = m.status === "in_progress";
    const mCourtConflicts = courtConflicts.get(m.id) || [];
    const mRestConflicts = restConflicts.get(m.id) || [];
    const hasWarnings = mCourtConflicts.some((c) => c.conflictType === "warning") || mRestConflicts.some((c) => c.conflictType === "warning");

    return (
      <div key={m.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">{m.match_code}</span>
          {m.is_tie && (
            <span className="text-[10px] font-black tracking-wider uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-500/20">
              Team Tie
            </span>
          )}
          <span className="text-[11px] font-bold text-slate-500">{CAT_LABELS[m.category] ?? m.category}</span>
          <span className="text-[11px] text-muted-foreground">· {m.round_name}</span>
          {live && <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-rose-600"><Radio className="w-3 h-3 animate-pulse" /> Live</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-2 min-w-0">
          <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate flex-1 text-right">{m.team1_label ?? "TBD"}</span>
          <span className="text-[11px] font-black text-slate-400 shrink-0">vs</span>
          <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate flex-1">{m.team2_label ?? "TBD"}</span>
        </div>

        {/* Rest Conflicts */}
        {mRestConflicts.map((c) => (
          <div
            key={c.playerId}
            role="alert"
            className={`mt-2 p-2 rounded-xl text-xs flex flex-col gap-1 ${
              c.conflictType === "hard"
                ? "bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300"
                : "bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300"
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              {c.conflictType === "hard" ? (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-black ${
                c.conflictType === "hard" ? "bg-rose-600 text-white" : "bg-amber-500 text-white"
              }`}>
                {c.conflictType === "hard" ? "Hard Conflict" : "Warning Conflict"}
              </span>
              <span>
                {playerSideLabel(m, c.playerId)} has {Math.max(0, c.gapMins)} min rest after {c.previousCode}
                {c.timingBasis === "estimated" ? " (estimated)" : " (actual)"}.
              </span>
            </div>
            {c.conflictType === "hard" && (
              <span className="text-[10px] opacity-80">
                Player must receive at least {c.minRestMinutes ?? tournamentPolicy.min_rest_minutes} minutes actual rest. Hard conflicts cannot be overridden.
              </span>
            )}
          </div>
        ))}

        {/* Court Conflicts */}
        {mCourtConflicts.map((c) => (
          <div
            key={c.otherMatchId || c.court}
            role="alert"
            className={`mt-2 p-2 rounded-xl text-xs flex flex-col gap-1 ${
              c.conflictType === "hard"
                ? "bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300"
                : "bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300"
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              {c.conflictType === "hard" ? (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-black ${
                c.conflictType === "hard" ? "bg-rose-600 text-white" : "bg-amber-500 text-white"
              }`}>
                {c.conflictType === "hard" ? "Hard Conflict" : "Warning Conflict"}
              </span>
              <span>
                {c.timingBasis === "unavailable_period"
                  ? `Court ${c.court} is unavailable: ${c.reason || "Blackout period"}`
                  : `Court ${c.court} overlaps ${c.otherCode} by ${c.overlapMins} min (${c.timingBasis === "estimated" ? "estimated" : "active match"}).`}
              </span>
            </div>
            {c.conflictType === "hard" ? (
              <span className="text-[10px] opacity-80">
                {c.timingBasis === "unavailable_period"
                  ? "This court is reserved / unavailable in tournament settings. Hard conflicts cannot be overridden."
                  : "An active match is running on this court. Hard conflicts cannot be overridden."}
              </span>
            ) : (
              <span className="text-[10px] opacity-80">
                Matches are projected to overlap based on the {tournamentPolicy.estimated_match_minutes}m duration estimate. Organizers may override with an audit reason.
              </span>
            )}
          </div>
        ))}

        {/* Alternative slot suggestions */}
        {(() => {
          if (mCourtConflicts.length === 0 && mRestConflicts.length === 0) return null;

          const usableMatches = matches.map((item) => {
            const ed = edits[item.id];
            return ed ? {
              ...item,
              court_number: ed.court.trim() || null,
              scheduled_at: localDateTimeInputToIso(ed.time),
            } : item;
          });

          const suggestions = suggestAlternativeSlots(
            {
              id: m.id,
              court_number: e.court.trim() || m.court_number,
              scheduled_at: localDateTimeInputToIso(e.time) || m.scheduled_at,
              status: m.status,
            },
            usableMatches,
            allCourts,
            tournamentPolicy.estimated_match_minutes,
            tournamentPolicy.unavailable_court_periods,
          );

          if (suggestions.length === 0) return null;

          return (
            <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-500" /> Suggested slots:
              </span>
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setEdit(m.id, {
                      court: s.court,
                      time: toLocalDateTimeInput(s.scheduledAt || s.scheduled_at),
                    });
                    toast.info(`Selected suggested slot: ${s.label}`);
                  }}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition"
                  title="Apply this conflict-free slot"
                >
                  {s.label}
                </button>
              ))}
            </div>
          );
        })()}

        {showEditor ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <input
                value={e.court}
                onChange={(ev) => setEdit(m.id, { court: ev.target.value })}
                placeholder="Court"
                className={`${fieldCls} w-16`}
              />
            </div>
            <input
              type="datetime-local"
              value={e.time}
              onChange={(ev) => setEdit(m.id, { time: ev.target.value })}
              className={fieldCls}
            />
            {hasWarnings && dirty(m) && (
              <button
                type="button"
                onClick={() => save(m)}
                disabled={savingId === m.id}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition disabled:opacity-40"
              >
                Override &amp; Save
              </button>
            )}
            <button
              onClick={() => save(m)}
              disabled={savingId === m.id || !dirty(m)}
              className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition disabled:opacity-40"
            >
              {savingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> Court {m.court_number}</span>
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(m.scheduled_at!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <ThemeScope {...tournament} className="space-y-4">
      {/* Header */}
      <div className={`${cardCls} flex items-center gap-3`}>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarClock className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-slate-800 dark:text-foreground">Order of Play</h3>
          <p className="text-xs text-muted-foreground">Assign courts and times, and see what's running on each court.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasTies && hasRubbers && (
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setViewScope("ALL")}
                className={`px-2 py-1 text-xs font-bold rounded-md transition ${viewScope === "ALL" ? "bg-white dark:bg-slate-700 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setViewScope("TIES")}
                className={`px-2 py-1 text-xs font-bold rounded-md transition ${viewScope === "TIES" ? "bg-white dark:bg-slate-700 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
              >
                Ties
              </button>
              <button
                type="button"
                onClick={() => setViewScope("RUBBERS")}
                className={`px-2 py-1 text-xs font-bold rounded-md transition ${viewScope === "RUBBERS" ? "bg-white dark:bg-slate-700 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
              >
                Rubbers
              </button>
            </div>
          )}

          <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldCls}>
            <option value="ALL">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{CAT_LABELS[c] ?? c}</option>)}
          </select>
          <button onClick={() => load(true)} className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition shrink-0" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className={`${cardCls} flex items-center justify-center py-12 text-muted-foreground`}><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : loadError ? (
        <div className={`${cardCls} text-center py-10`}>
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Couldn't load matches</p>
          <button onClick={() => load()} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : (
        <>
          {conflictCount > 0 && (
            <div role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {conflictCount} match{conflictCount === 1 ? "" : "es"} have a player-rest or court-overlap warning. Check the highlighted rows.
            </div>
          )}

          {/* Needs scheduling */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-200">Needs scheduling</h4>
              <span className="text-[11px] font-bold text-muted-foreground">({unscheduled.length})</span>
            </div>
            {unscheduled.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Every match has a court and a time. 🎉</p>
            ) : (
              <div className="space-y-2">{unscheduled.map((m) => matchRow(m, true))}</div>
            )}
          </div>

          {/* Court overview */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-3">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-200">On courts</h4>
            </div>
            {byCourt.length === 0 ? (
              <div className="text-center py-6">
                <Swords className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No matches assigned to a court yet.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {byCourt.map(([court, list]) => (
                  <div key={court} className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-black">
                      <MapPin className="w-3.5 h-3.5" /> Court {court}
                      <span className="text-[10px] opacity-70">· {list.length}</span>
                    </div>
                    <div className="space-y-2">{list.map((m) => matchRow(m, false))}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Audited Schedule Override Modal */}
      {overrideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="override-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="override-modal-title" className="text-base font-black text-slate-900 dark:text-slate-100">
                    Override Schedule Conflict
                  </h3>
                  <p className="text-xs text-muted-foreground">{overrideModal.match.match_code} · Court {overrideModal.court}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOverrideModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 font-medium">
              <p className="font-bold mb-1">Warning Details:</p>
              <p>{overrideModal.warningMessage}</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Audit Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Previous match running faster than expected; players agreed to shorter rest."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                required
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                This schedule override will be recorded in the Admin Activity Log with your official ID and timestamp.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOverrideModal(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOverride}
                disabled={overriding || !overrideReason.trim()}
                className="px-4 py-2 text-xs font-black rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-40 inline-flex items-center gap-1.5 shadow-sm"
              >
                {overriding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirm &amp; Log Override
              </button>
            </div>
          </div>
        </div>
      )}
    </ThemeScope>
  );
}
