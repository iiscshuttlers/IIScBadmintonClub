import React, { useState } from "react";
import { toast } from "sonner";
import {
  Trophy, Lock, Bell, CalendarDays, ArrowLeftRight, X, Play, SkipForward,
  Unlock, Undo2, RotateCcw, Camera, Users, MapPin, Download, Upload, Loader2,
  AlertCircle, Check, Trash2, ChevronDown, ShieldCheck
} from "lucide-react";
import { MatchCorrectionDialog } from "@/components/admin/MatchCorrectionDialog";
import { MatchScoreDisplay } from "@/components/tournament/MatchScoreDisplay";
import { PlayerSelect } from "@/components/umpire/PlayerSelect";
import { downloadCSV, readCSVFile } from "@/utils/csvUtils";
import type { Tournament, TournamentMatch } from "@/types/tournament";
import {
  fetchTournamentParticipantsByCategory,
  adminUpdateTournamentMatch,
  deleteTournamentMatch,
  submitTournamentMatch,
  recordTournamentWalkover,
  undoTournamentMatch as undoTournamentMatchRpc,
  notifyTournamentMatch,
} from "@/services/tournamentService";

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";
const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
const labelCls = "block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5";

const COURT_COLORS: Record<string, string> = {
  C1: "bg-[var(--info)] dark:bg-[var(--info)]/40 text-[var(--info)] dark:text-[var(--info)]",
  C2: "bg-[var(--success)] dark:bg-[var(--success)]/40 text-[var(--success)] dark:text-[var(--success)]",
  C3: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  C4: "bg-[var(--warning)] dark:bg-[var(--warning)]/40 text-[var(--warning)] dark:text-[var(--warning)]",
  C5: "bg-[var(--danger)] dark:bg-[var(--danger)]/40 text-[var(--danger)] dark:text-[var(--danger)]",
  C6: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300",
};

export function getCourtColorClass(court: string) {
  return COURT_COLORS[court.toUpperCase()] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
}

export function MatchStatusChip({ match }: { match: { status: string; scheduled_at?: string | null; court_number?: string | null } }) {
  if (match.status === "walkover") return <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--info)] dark:bg-[var(--info)]/40 text-[var(--info)] whitespace-nowrap">W/O</span>;
  if (match.status === "completed") return <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 dark:bg-primary/40 text-primary whitespace-nowrap">COMPLETED</span>;
  if (match.status === "in_progress") return <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--warning)] dark:bg-[var(--warning)]/40 text-[var(--warning)] whitespace-nowrap">LIVE</span>;
  if (match.scheduled_at) return <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--info)] dark:bg-[var(--info)]/40 text-[var(--info)] whitespace-nowrap">SCHEDULED</span>;
  return <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground whitespace-nowrap">PENDING</span>;
}

export interface TournamentMatchesTabProps {
  tournament: Tournament;
  matches: TournamentMatch[];
  activeCategory: string;
  isMasterAdmin: boolean;
  allPlayers?: any[];
  load: () => Promise<void>;
  setMatches: React.Dispatch<React.SetStateAction<TournamentMatch[]>>;
  confirm: (opts: any) => Promise<boolean>;
  session: any;
  showBulkSchedule: boolean;
  setShowBulkSchedule: (show: boolean) => void;
}

export function TournamentMatchesTab({
  tournament,
  matches,
  activeCategory,
  isMasterAdmin,
  allPlayers,
  load,
  setMatches,
  confirm,
  session,
  showBulkSchedule,
  setShowBulkSchedule,
}: TournamentMatchesTabProps) {
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<{ id: string; t1: string; t2: string } | null>(null);
  const [editScore, setEditScore] = useState<{
    matchId: string; side: 1 | 2; sets: string; bestOfSets: number; goldenPoint: number; pointsToWin: number;
    setsData: { t1: string; t2: string }[];
  } | null>(null);
  const [editSchedule, setEditSchedule] = useState<{ matchId: string; court: string; at: string } | null>(null);
  const [assignUmpire, setAssignUmpire] = useState<{ matchId: string; umpireId: string } | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<{ matchCode: string; court: string; at: string; found: boolean; wrongCategory?: boolean }[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [remindSendingId, setRemindSendingId] = useState<string | null>(null);
  const [remindSentMap, setRemindSentMap] = useState<Record<string, boolean>>({});
  const [swapParticipant, setSwapParticipant] = useState<{ matchId: string; side: 1 | 2 } | null>(null);
  const [catParticipants, setCatParticipants] = useState<{ id: string; player_id: string | null; partner_id: string | null; display_name: string | null; category: string }[]>([]);
  const [swapSaving, setSwapSaving] = useState(false);

  const loadParticipants = async (cat: string) => {
    try {
      const data = await fetchTournamentParticipantsByCategory(tournament.id, cat);
      setCatParticipants(data);
    } catch {
      setCatParticipants([]);
    }
  };

  const executeSwap = async (participantId: string) => {
    if (!swapParticipant) return;
    setSwapSaving(true);
    const p = catParticipants.find((x) => x.id === participantId);
    if (!p) { setSwapSaving(false); return; }
    const label = p.display_name ?? allPlayers?.find((x: any) => x.id === p.player_id)?.full_name ?? "Unknown";
    const payload: Partial<TournamentMatch> = {};
    if (swapParticipant.side === 1) {
      payload.player1_id = p.player_id;
      payload.player3_id = p.partner_id;
      payload.team1_label = label;
    } else {
      payload.player2_id = p.player_id;
      payload.player4_id = p.partner_id;
      payload.team2_label = label;
    }
    try {
      await adminUpdateTournamentMatch(swapParticipant.matchId, payload, "Replace a pre-start bracket participant");
      toast.success("Participant swapped");
      setSwapParticipant(null);
      await load();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSwapSaving(false);
    }
  };

  const setStatus = async (matchId: string, status: string) => {
    setActingOn(matchId);
    try {
      await adminUpdateTournamentMatch(matchId, { status }, `Set match status to ${status}`);
      setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, status } : m));
    } catch (e: any) {
      toast.error("Failed to update status: " + e.message);
    } finally {
      setActingOn(null);
    }
  };

  const submitWalkover = async (matchId: string, winningSide: 0 | 1 | 2) => {
    setActingOn(matchId);
    try {
      await recordTournamentWalkover({
        p_match_id: matchId,
        p_winner_side: winningSide,
        p_umpire_id: null,
      });
      toast.success(winningSide === 0 ? "Double Walkover recorded" : "Walkover recorded");
      await load();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActingOn(null);
    }
  };

  const assignBye = async (matchId: string, winningSide: 1 | 2) => {
    setActingOn(matchId);
    try {
      await recordTournamentWalkover({
        p_match_id: matchId,
        p_winner_side: winningSide,
        p_umpire_id: null,
      });
      toast.success("BYE assigned");
      await load();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActingOn(null);
    }
  };

  const undoTournamentMatch = async (id: string) => {
    const ok = await confirm({
      title: "Undo Tournament Match",
      description: "Are you sure you want to undo this tournament match? This will clear the score, reset the bracket slot, and revert ELO for all players.",
      confirmLabel: "Undo Match",
      confirmVariant: "danger",
    });
    if (!ok) return;
    setActingOn(id);
    try {
      await undoTournamentMatchRpc(id);
      toast.success("Tournament match undone successfully");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to undo match");
    } finally {
      setActingOn(null);
    }
  };

  const autoWinnerFromSets = (setsStr: string, bestOfSets: number): 1 | 2 | null => {
    const sets = setsStr.split(",").map((s) => s.trim()).filter(Boolean);
    let t1 = 0, t2 = 0;
    for (const s of sets) {
      const [a, b] = s.split("-").map(Number);
      if (!isNaN(a) && !isNaN(b)) { if (a > b) t1++; else if (b > a) t2++; }
    }
    const needed = Math.ceil(bestOfSets / 2);
    if (t1 >= needed) return 1;
    if (t2 >= needed) return 2;
    return null;
  };

  const submitEditScore = async () => {
    if (!editScore) return;
    const ptw = editScore.pointsToWin;
    const gp = editScore.goldenPoint;
    let t1Wins = 0;
    let t2Wins = 0;
    const needed = Math.ceil(editScore.bestOfSets / 2);

    for (let i = 0; i < editScore.setsData.length; i++) {
      const s = editScore.setsData[i];
      if (s.t1 === "" || s.t2 === "") continue;

      if (t1Wins >= needed || t2Wins >= needed) {
        toast.error(`Invalid score: The match was already won in earlier sets. You cannot enter a score for set ${i + 1}.`);
        return;
      }

      const t1 = parseInt(s.t1, 10) || 0;
      const t2 = parseInt(s.t2, 10) || 0;
      const win = Math.max(t1, t2);
      const lose = Math.min(t1, t2);
      
      let valid = false;
      if (win === ptw && (win - lose) >= 2) valid = true;
      else if (win > ptw && win < gp && (win - lose) === 2) valid = true;
      else if (win === gp && (win - lose) >= 1 && (win - lose) <= 2) valid = true;
      if (win === 0 && lose === 0) continue;

      if (!valid) {
        toast.error(`Invalid score in set ${i + 1}: ${t1}-${t2}. Enter a mathematically valid badminton score.`);
        return;
      }

      if (t1 > t2) t1Wins++;
      else if (t2 > t1) t2Wins++;
    }

    const setsArr = editScore.setsData
      .filter((s) => s.t1 !== "" && s.t2 !== "")
      .map((s) => `${s.t1}-${s.t2}`);
    if (!setsArr.length) { toast.error("Enter at least one set score"); return; }
    const scoreStr = setsArr.join(", ");
    try {
      await submitTournamentMatch({
        p_match_id: editScore.matchId,
        p_winner_side: editScore.side,
        p_score: scoreStr,
        p_sets: setsArr,
        p_umpire_id: null,
        p_expected_revision: matches.find((match) => match.id === editScore.matchId)?.result_revision ?? 0,
      });
      toast.success("Score saved");
      await load();
    } catch (error: any) {
      toast.error(error.message);
    }
    setEditScore(null);
  };

  const saveSchedule = async () => {
    if (!editSchedule) return;
    let isoAt = editSchedule.at || null;
    if (isoAt) {
      const d = new Date(isoAt);
      if (!isNaN(d.getTime())) isoAt = d.toISOString();
    }

    const match = matches.find((m) => m.id === editSchedule.matchId);

    let newStatus = match?.status;
    if (match?.status === "pending" && (isoAt || editSchedule.court)) {
      newStatus = "scheduled";
    } else if (match?.status === "scheduled" && !isoAt && !editSchedule.court) {
      newStatus = "pending";
    }

    try {
      await adminUpdateTournamentMatch(editSchedule.matchId, {
        court_number: editSchedule.court || null,
        scheduled_at: isoAt,
        status: newStatus,
        reminder_sent: false,
      }, "Edit the match court and scheduled time");
      await load();
      setEditSchedule(null);
      toast.success("Schedule saved");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const saveUmpire = async () => {
    if (!assignUmpire) return;
    setActingOn(assignUmpire.matchId);
    try {
      await adminUpdateTournamentMatch(assignUmpire.matchId, {
        umpired_by: assignUmpire.umpireId || null,
      }, assignUmpire.umpireId ? "Assign an umpire" : "Remove the umpire assignment");
      toast.success("Umpire updated");
      await load();
      setAssignUmpire(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActingOn(null);
    }
  };

  const downloadScheduleTemplate = () => {
    const header = ["MatchCode", "Court", "Date (YYYY-MM-DD)", "Time (HH:MM)"];
    const rows = matches
      .filter((m) => m.category === activeCategory && m.team1_label !== "BYE" && m.team2_label !== "BYE")
      .sort((a, b) => a.round - b.round || a.match_number - b.match_number)
      .map((m) => [
        m.match_code,
        m.court_number ?? "",
        m.scheduled_at ? m.scheduled_at.slice(0, 10) : "",
        m.scheduled_at ? m.scheduled_at.slice(11, 16) : "",
      ]);
    downloadCSV(`${activeCategory}_schedule_template.csv`, [header, ...rows]);
  };

  const handleScheduleCSV = async (file: File) => {
    const rows = await readCSVFile(file);
    const dataRows = rows[0]?.[0]?.match(/^[A-Z]+_/) ? rows : rows.slice(1);
    const lines = dataRows
      .filter((r) => r[0])
      .map((r) => {
        const code = r[0].toUpperCase();
        const court = r[1] ?? "";
        const date = r[2] ?? "";
        const time = r[3] ?? "";
        const parts = [code];
        if (court) parts.push(`court=${court}`);
        if (date && time) parts.push(`date=${date} time=${time}`);
        else if (date) parts.push(`date=${date}`);
        return parts.join(" ");
      });
    setBulkText(lines.join("\n"));
    parseBulkSchedule(lines.join("\n"));
  };

  const parseBulkSchedule = (text: string) => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const results: { matchCode: string; court: string; at: string; found: boolean; wrongCategory?: boolean }[] = [];
    for (const line of lines) {
      if (line.startsWith("#") || line.startsWith("//")) continue;
      const matchCode = line.split(/[\s,:,\t]+/)[0].toUpperCase();
      if (!matchCode) continue;

      let court = "";
      let at = "";

      const kvCourt = line.match(/court\s*=\s*([^\s,]+)/i);
      const kvDate = line.match(/date\s*=\s*(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4})/i);
      const kvTime = line.match(/time\s*=\s*(\d{1,2})(:\d{2})?(:\d{2})?/i);
      if (kvCourt) court = kvCourt[1];
      if (kvDate && kvTime) {
        let d = kvDate[1];
        if (d.match(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/)) {
          const dParts = d.split(/[-\/]/);
          d = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
        }
        let t = kvTime[1].padStart(2, "0");
        t += kvTime[2] ? kvTime[2] : ":00";
        try {
          at = new Date(`${d}T${t}`).toISOString();
        } catch {
          /* intentional — fallback to local datetime string */
          at = `${d}T${t}`;
        }
      }

      if (!court || !at) {
        const courtMatch = line.match(/court\s*(\w+)/i);
        if (courtMatch) court = courtMatch[1];

        const isoDate = line.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/i);
        const dmy = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})\s+(\d{2}:\d{2})/i);
        if (isoDate) {
          try { at = new Date(`${isoDate[1]}T${isoDate[2]}`).toISOString(); } catch { /* intentional */ at = `${isoDate[1]}T${isoDate[2]}`; }
        } else if (dmy) {
          try { at = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}`).toISOString(); } catch { /* intentional */ at = `${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}`; }
        }
      }

      const match = matches.find((m) => m.match_code === matchCode);
      const found = !!match;
      const wrongCategory = match ? match.category !== activeCategory : false;
      const existing = results.find(r => r.matchCode === matchCode);
      
      if (existing) {
        if (court) existing.court = court;
        if (at) existing.at = at;
      } else {
        results.push({ matchCode, court, at, found, wrongCategory });
      }
    }
    setBulkPreview(results);
  };

  const saveBulkSchedule = async () => {
    setBulkSaving(true);
    let saved = 0;
    for (const row of bulkPreview) {
      if (!row.found || row.wrongCategory) continue;
      const match = matches.find((m) => m.match_code === row.matchCode);
      if (!match) continue;
      
      let newStatus = match.status;
      if (match.status === "pending" && (row.at || row.court)) {
        newStatus = "scheduled";
      } else if (match.status === "scheduled" && !row.at && !row.court) {
        newStatus = "pending";
      }

      await adminUpdateTournamentMatch(match.id, {
        court_number: row.court || null,
        scheduled_at: row.at || null,
        status: newStatus,
      }, "Bulk order-of-play schedule update");
      saved++;
    }
    await load();
    setBulkSaving(false);
    setShowBulkSchedule(false);
    setBulkText("");
    setBulkPreview([]);
    toast.success(`Bulk schedule saved for ${saved} match${saved !== 1 ? "es" : ""}`);
  };

  const categoryMatches = matches.filter((m) => m.category === activeCategory);
  const rounds = [...new Set(categoryMatches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {correcting && (
        <MatchCorrectionDialog
          open
          onOpenChange={(o) => { if (!o) setCorrecting(null); }}
          matchId={correcting.id}
          team1Label={correcting.t1}
          team2Label={correcting.t2}
          onApplied={() => void load()}
        />
      )}
      {[...rounds].reverse().map((round) => {
        const roundMatches = categoryMatches
          .filter((m) => m.round === round)
          .sort((a, b) => {
            const p = (s: string) => {
              if (s === "in_progress" || s === "IN_PROGRESS") return 0;
              if (s === "completed" || s === "COMPLETED" || s === "walkover") return 2;
              return 1;
            };
            return p(a.status) - p(b.status);
          });
        const roundName = roundMatches[0]?.round_name ?? `Round ${round}`;
        return (
          <details key={round} className="group mb-6">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-2 mb-3 select-none outline-none hover:bg-slate-50 dark:hover:bg-slate-900/50 p-2 rounded-xl transition">
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:-rotate-180" />
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">{roundName}</h3>
            </summary>
            <div className="space-y-2 pl-2">
              {roundMatches.map((m) => {
                const busy = actingOn === m.id;
                const isEditing = editScore?.matchId === m.id;
                const isScheduling = editSchedule?.matchId === m.id;
                const isByeMatch = m.team1_label === "BYE" || m.team2_label === "BYE";
                const canEdit = (!m.locked || isMasterAdmin) && !isByeMatch;

                return (
                  <div key={m.id} className={`${cardCls} !p-0 overflow-hidden`}>
                    <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">{m.match_code}</span>
                      <MatchStatusChip match={m} />
                      {m.reminder_sent && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-500 dark:text-emerald-400" title="Notification sent">
                          <Bell className="w-3 h-3 fill-current" /> Notified
                        </span>
                      )}
                      {m.locked && <Lock className="w-3.5 h-3.5 text-[var(--warning)]" aria-label="Locked" />}
                      {m.scored_by && m.status === 'completed' && (
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 ml-auto">
                          <Trophy className="w-3 h-3" /> {allPlayers?.find((p) => p.id === m.scored_by)?.full_name || "Umpire"}
                        </span>
                      )}
                    </div>

                    <div className="px-4 py-3">
                      {(m.court_number || m.scheduled_at) && (
                        <div className="flex items-center gap-2 flex-wrap mb-2.5">
                          {m.court_number && (
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${getCourtColorClass(m.court_number)}`}>
                              Court {m.court_number}
                            </span>
                          )}
                          {m.scheduled_at && (
                            <span className="text-[10px] text-muted-foreground dark:text-slate-400 flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {new Date(m.scheduled_at).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold truncate ${m.winner_side === 1 ? "text-primary" : "text-foreground dark:text-slate-200"}`}>
                            {m.team1_label ?? "TBD"}
                            {m.status === "scheduled" && (!m.locked || isMasterAdmin) && m.team1_label && m.team1_label !== "TBD" && (
                              <button onClick={() => { setSwapParticipant({ matchId: m.id, side: 1 }); loadParticipants(m.category); }}
                                className="ml-1 inline-flex align-middle text-muted-foreground hover:text-[var(--info)] transition" title="Swap participant">
                                <ArrowLeftRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase shrink-0">vs</span>
                        <div className="flex-1 min-w-0 text-right">
                          <div className={`text-sm font-bold truncate ${m.winner_side === 2 ? "text-primary" : "text-foreground dark:text-slate-200"}`}>
                            {m.status === "scheduled" && (!m.locked || isMasterAdmin) && m.team2_label && m.team2_label !== "TBD" && (
                              <button onClick={() => { setSwapParticipant({ matchId: m.id, side: 2 }); loadParticipants(m.category); }}
                                className="mr-1 inline-flex align-middle text-muted-foreground hover:text-[var(--info)] transition" title="Swap participant">
                                <ArrowLeftRight className="w-3 h-3" />
                              </button>
                            )}
                            {m.team2_label ?? "TBD"}
                          </div>
                        </div>
                      </div>

                      {swapParticipant?.matchId === m.id && (
                        <div className="mt-2 p-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-1.5">
                            <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--info)]" />
                            <span className="text-[11px] font-black text-[var(--info)]">
                              Swap {swapParticipant.side === 1 ? m.team1_label : m.team2_label}
                            </span>
                            <button onClick={() => setSwapParticipant(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <select
                            className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
                            defaultValue=""
                            disabled={swapSaving}
                            onChange={(e) => { if (e.target.value) executeSwap(e.target.value); }}
                          >
                            <option value="" disabled>Select participant...</option>
                            {catParticipants.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.display_name ?? "Unknown"}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {m.status === "completed" && (
                        <div className="mt-2">
                          <MatchScoreDisplay
                            sets_history={m.sets_history}
                            team1_label={m.team1_label ?? "Team 1"}
                            team2_label={m.team2_label ?? "Team 2"}
                            winner_side={m.winner_side}
                            status={m.status}
                          />
                        </div>
                      )}
                    </div>

                    <div className="px-4 pb-3 pt-1 space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {m.status === "scheduled" && canEdit && (
                          <button onClick={() => setStatus(m.id, "in_progress")} disabled={busy}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-[var(--warning)] dark:bg-[var(--warning)]/40 text-[var(--warning)] dark:text-[var(--warning)] hover:bg-[var(--warning)] dark:hover:bg-[var(--warning)]/40 transition">
                            <Play className="w-3 h-3" /> Start
                          </button>
                        )}
                        {m.status !== "completed" && canEdit && (
                          <>
                            <button onClick={() => {
                              const bo = m.best_of_sets ?? 3;
                              const gp = m.golden_point ?? 30;
                              const ptw = m.points_to_win ?? 21;
                              setEditScore({ matchId: m.id, side: 1, sets: "", bestOfSets: bo, goldenPoint: gp, pointsToWin: ptw, setsData: Array.from({ length: bo }, () => ({ t1: "", t2: "" })) });
                            }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-primary/15 dark:bg-primary/40 text-primary hover:bg-primary/25 dark:hover:bg-primary/50 transition">
                              <Trophy className="w-3 h-3" /> Score
                            </button>
                            <button onClick={() => submitWalkover(m.id, 1)} disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <SkipForward className="w-3 h-3" /> W/O T1
                            </button>
                            <button onClick={() => submitWalkover(m.id, 2)} disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <SkipForward className="w-3 h-3" /> W/O T2
                            </button>
                            <button onClick={() => submitWalkover(m.id, 0)} disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-[var(--danger)] dark:border-[var(--danger)]/40 text-[var(--danger)] dark:text-[var(--danger)] hover:bg-red-50 dark:hover:bg-[var(--danger)]/20 transition">
                              <SkipForward className="w-3 h-3" /> Double W/O
                            </button>
                            <button onClick={() => assignBye(m.id, 1)} disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition">
                              <SkipForward className="w-3 h-3" /> BYE T1
                            </button>
                            <button onClick={() => assignBye(m.id, 2)} disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition">
                              <SkipForward className="w-3 h-3" /> BYE T2
                            </button>
                          </>
                        )}
                        {m.status === "completed" && !isByeMatch && (
                          <button
                            onClick={() => setCorrecting({ id: m.id, t1: m.team1_label ?? "Side 1", t2: m.team2_label ?? "Side 2" })}
                            className="flex items-center gap-1 px-2.5 py-1.5 min-h-[32px] text-[11px] font-bold rounded-lg border border-primary/50 text-primary hover:bg-primary/5 transition"
                            title="Preview and apply an audited result correction"
                          >
                            <ShieldCheck className="w-3 h-3" /> Correct
                          </button>
                        )}
                        {m.status === "completed" && isMasterAdmin && (
                          <>
                            <button onClick={() => setCorrecting({ id: m.id, t1: m.team1_label ?? "Side 1", t2: m.team2_label ?? "Side 2" })}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-[var(--warning)] dark:border-[var(--warning)] text-[var(--warning)] dark:text-[var(--warning)] hover:bg-amber-50 dark:hover:bg-[var(--warning)]/30 transition">
                              <Unlock className="w-3 h-3" /> Correct
                            </button>
                            <button onClick={() => undoTournamentMatch(m.id)} disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-[var(--danger)] dark:border-[var(--danger)] text-[var(--danger)] dark:text-[var(--danger)] hover:bg-red-50 dark:hover:bg-[var(--danger)]/30 transition">
                              <Undo2 className="w-3 h-3" /> Undo Match
                            </button>
                          </>
                        )}

                        <div className="flex-1" />

                        {!isByeMatch && m.status === "scheduled" && (
                          <button
                            disabled={remindSendingId === m.id}
                            onClick={async () => {
                              setRemindSendingId(m.id);
                              try {
                                await notifyTournamentMatch(m.id, "manual");
                                toast.success("Reminder sent!");
                                setRemindSentMap((prev) => ({ ...prev, [m.id]: true }));
                                setTimeout(() => {
                                  setRemindSentMap((prev) => ({ ...prev, [m.id]: false }));
                                }, 3000);
                              } catch (e: any) {
                                toast.error(e.message ?? "Failed to send reminder");
                              } finally {
                                setRemindSendingId(null);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                          >
                            {remindSendingId === m.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-[var(--warning)]" />
                                <span>Sending...</span>
                              </>
                            ) : remindSentMap[m.id] ? (
                              <>
                                <Check className="w-3 h-3 text-[var(--success)]" />
                                <span className="text-[var(--success)] dark:text-[var(--success)] font-black">Sent!</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3 text-[var(--warning)]" />
                                <span>Remind</span>
                              </>
                            )}
                          </button>
                        )}
                        {!isByeMatch && (
                          <>
                            <button onClick={() => {
                              let localAt = "";
                              if (m.scheduled_at) {
                                const d = new Date(m.scheduled_at);
                                const pad = (n: number) => n.toString().padStart(2, '0');
                                localAt = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                              }
                              setEditSchedule({ matchId: m.id, court: m.court_number ?? "", at: localAt });
                            }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <CalendarDays className="w-3 h-3" /> Schedule
                            </button>
                            <button onClick={() => { window.location.href = `${import.meta.env.BASE_URL}tv/camera/${m.id}`; }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-[var(--danger)] dark:border-[var(--danger)]/50 text-[var(--danger)] dark:text-[var(--danger)] hover:bg-rose-50 dark:hover:bg-[var(--danger)]/30 transition">
                              <Camera className="w-3 h-3" /> Camera
                            </button>
                          </>
                        )}
                      </div>

                      {isMasterAdmin && !isByeMatch && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-dashed border-slate-200/60 dark:border-slate-700/40">
                          {(isMasterAdmin || session?.user?.id === m.umpired_by) && m.status !== "completed" && (
                            <button onClick={() => setAssignUmpire({ matchId: m.id, umpireId: m.umpired_by ?? "" })}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <Users className="w-3 h-3" /> Umpire
                            </button>
                          )}

                          {m.status !== "scheduled" && (
                            <button onClick={async () => {
                              const ok = await confirm({
                                title: "Reset Match",
                                description: "Reset this match to Scheduled? This wipes score and status.",
                                confirmLabel: "Reset",
                                confirmVariant: "danger",
                              });
                              if (!ok) return;
                              setActingOn(m.id);
                              try {
                                await undoTournamentMatchRpc(m.id);
                                toast.success("Match result undone through the audited bracket rollback");
                                await load();
                              } catch (error: any) {
                                toast.error(error.message);
                              } finally {
                                setActingOn(null);
                              }
                            }}
                              disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-red-50 dark:bg-[var(--danger)]/30 text-[var(--danger)] dark:text-[var(--danger)] hover:bg-[var(--danger)] dark:hover:bg-[var(--danger)]/30 transition">
                              <RotateCcw className="w-3 h-3" /> Reset
                            </button>
                          )}
                          {m.match_code.includes("_3RD_") && (
                            <button onClick={async () => {
                              const ok = await confirm({
                                title: "Delete 3rd Place Match",
                                description: `Delete ${m.match_code}? This cannot be undone.`,
                                confirmLabel: "Delete",
                                confirmVariant: "danger",
                              });
                              if (!ok) return;
                              setActingOn(m.id);
                              try {
                                await deleteTournamentMatch(m.id);
                                toast.success("3rd place match deleted");
                                await load();
                              } catch (error: any) {
                                toast.error(error.message);
                              } finally {
                                setActingOn(null);
                              }
                            }}
                              disabled={busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-red-50 dark:bg-[var(--danger)]/30 text-[var(--danger)] dark:text-[var(--danger)] hover:bg-[var(--danger)] dark:hover:bg-[var(--danger)]/30 transition">
                              <Trash2 className="w-3 h-3" /> Delete 3rd Place
                            </button>
                          )}
                          <div className="flex-1" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
                            <select
                              value={m.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                if (newStatus === m.status) return;
                                const ok = await confirm({
                                  title: "Change Match Status",
                                  description: `Force change to ${newStatus.toUpperCase()}?`,
                                  confirmLabel: "Change Status",
                                  confirmVariant: "primary",
                                });
                                if (!ok) return;
                                setActingOn(m.id);
                                const prev = { status: m.status };
                                try {
                                  await adminUpdateTournamentMatch(m.id, { status: newStatus }, `Force status from ${m.status} to ${newStatus}`);
                                  toast.success("Status updated", {
                                    action: { label: "Undo", onClick: async () => {
                                      await adminUpdateTournamentMatch(m.id, prev, `Undo forced status change back to ${m.status}`);
                                      await load();
                                    }},
                                    duration: 5000
                                  });
                                  await load();
                                } catch (error: any) {
                                  toast.error(error.message);
                                } finally {
                                  setActingOn(null);
                                }
                              }}
                              disabled={busy}
                              className="bg-transparent border border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-muted-foreground rounded-lg px-2 py-1 outline-none transition cursor-pointer"
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="in_progress">In Progress</option>
                            </select>
                          </div>
                        </div>
                      )}
                      {isByeMatch && m.status !== "completed" && isMasterAdmin && (
                        <button onClick={async () => {
                          setActingOn(m.id);
                          const wSide = m.team1_label === "BYE" ? 2 : 1;
                          try {
                            await recordTournamentWalkover({ p_match_id: m.id, p_winner_side: wSide, p_umpire_id: null });
                            toast.success("BYE match restored");
                            await load();
                          } catch (error: any) {
                            toast.error(error.message);
                          } finally {
                            setActingOn(null);
                          }
                        }}
                          disabled={busy}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-primary/15 dark:bg-primary/40 text-primary hover:bg-primary/25 transition">
                          <RotateCcw className="w-3 h-3" /> Restore BYE
                        </button>
                      )}
                    </div>

                    {isEditing && (function() {
                      const sd = editScore!.setsData;
                      const setsStr = sd.filter(s => s.t1 !== "" && s.t2 !== "").map(s => `${s.t1}-${s.t2}`).join(", ");
                      const autoWinner = autoWinnerFromSets(setsStr, editScore!.bestOfSets);
                      const updateSet = (i: number, field: "t1" | "t2", val: string) => {
                        let numStr = val.replace(/\D/g, "");
                        if (numStr) {
                          const num = parseInt(numStr, 10);
                          if (num > editScore!.goldenPoint) numStr = editScore!.goldenPoint.toString();
                        }
                        const next = sd.map((s, idx) => idx === i ? { ...s, [field]: numStr } : s);
                        const nextStr = next.filter(s => s.t1 !== "" && s.t2 !== "").map(s => `${s.t1}-${s.t2}`).join(", ");
                        const auto = autoWinnerFromSets(nextStr, editScore!.bestOfSets);
                        setEditScore((p) => p && ({ ...p, setsData: next, sets: nextStr, ...(auto ? { side: auto } : {}) }));
                      };
                      return (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                          <div className="flex items-center justify-center gap-2 mb-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-slate-50 dark:bg-slate-800/50 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/50">
                            <span title="Points required to win a set">Win at {editScore!.pointsToWin}</span>
                            <span className="opacity-30">•</span>
                            <span title="Best of X sets">Best of {editScore!.bestOfSets}</span>
                            <span className="opacity-30">•</span>
                            <span title="Maximum points possible (Golden Point)">GP {editScore!.goldenPoint}</span>
                          </div>
                          <div className="grid grid-cols-[3rem_1fr_1.5rem_1fr] gap-x-2 items-center">
                            <div />
                            <div className="text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1">
                              {(function() {
                                const l = m.team1_label ?? "Team 1";
                                if (!l.includes("&")) return <div className="break-words whitespace-normal leading-[1.1]">{l}</div>;
                                const parts = l.split("&");
                                return (
                                  <div className="flex flex-col items-center leading-[1.1]">
                                    <span className="break-words whitespace-normal w-full">{parts[0].trim()}</span>
                                    <span className="text-[8px] opacity-40 lowercase my-0.5">and</span>
                                    <span className="break-words whitespace-normal w-full">{parts[1].trim()}</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <div />
                            <div className="text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1">
                              {(function() {
                                const l = m.team2_label ?? "Team 2";
                                if (!l.includes("&")) return <div className="break-words whitespace-normal leading-[1.1]">{l}</div>;
                                const parts = l.split("&");
                                return (
                                  <div className="flex flex-col items-center leading-[1.1]">
                                    <span className="break-words whitespace-normal w-full">{parts[0].trim()}</span>
                                    <span className="text-[8px] opacity-40 lowercase my-0.5">and</span>
                                    <span className="break-words whitespace-normal w-full">{parts[1].trim()}</span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          {sd.map((s, i) => {
                            const setsBeforeStr = sd.slice(0, i).filter(prev => prev.t1 !== "" && prev.t2 !== "").map(prev => `${prev.t1}-${prev.t2}`).join(",");
                            const isAlreadyWon = autoWinnerFromSets(setsBeforeStr, editScore!.bestOfSets) !== null;
                            const prevFilled = i === 0 || (sd[i - 1].t1 !== "" && sd[i - 1].t2 !== "");
                            const isDisabled = !prevFilled || isAlreadyWon;

                            const t1n = parseInt(s.t1), t2n = parseInt(s.t2);
                            const t1Won = !isNaN(t1n) && !isNaN(t2n) && t1n > t2n;
                            const t2Won = !isNaN(t1n) && !isNaN(t2n) && t2n > t1n;
                            return (
                              <div key={i} className={`grid grid-cols-[3rem_1fr_1.5rem_1fr] gap-x-2 items-center ${isDisabled ? "opacity-40 pointer-events-none grayscale" : ""}`}>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">G{i + 1}</span>
                                <input
                                  type="text" inputMode="numeric" value={s.t1}
                                  onChange={(e) => updateSet(i, "t1", e.target.value)}
                                  disabled={isDisabled}
                                  placeholder="—"
                                  className={`text-center font-black text-base rounded-xl border-2 py-2 outline-none transition w-full
                                    ${t1Won ? "border-primary bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary/70"
                                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-foreground"}
                                    focus:border-primary`}
                                />
                                <span className="text-center text-xs font-bold text-muted-foreground">–</span>
                                <input
                                  type="text" inputMode="numeric" value={s.t2}
                                  onChange={(e) => updateSet(i, "t2", e.target.value)}
                                  disabled={isDisabled}
                                  placeholder="—"
                                  className={`text-center font-black text-base rounded-xl border-2 py-2 outline-none transition w-full
                                    ${t2Won ? "border-primary bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary/70"
                                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-foreground"}
                                    focus:border-primary`}
                                />
                              </div>
                            );
                          })}
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0">Winner</span>
                            {autoWinner ? (
                              <span className="flex items-center gap-1.5 text-xs font-black text-primary dark:text-primary">
                                <Trophy className="w-3 h-3" />
                                {editScore!.side === 1 ? (m.team1_label ?? "Team 1") : (m.team2_label ?? "Team 2")}
                                <span className="text-muted-foreground font-normal">(auto-detected)</span>
                              </span>
                            ) : (
                              <select value={editScore!.side} onChange={(e) => setEditScore((p) => p && ({ ...p, side: parseInt(e.target.value) as 1 | 2 }))}
                                className="text-sm px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-primary">
                                <option value={1}>{m.team1_label ?? "Team 1"}</option>
                                <option value={2}>{m.team2_label ?? "Team 2"}</option>
                              </select>
                            )}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={submitEditScore}
                              className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary text-primary-foreground text-xs font-black transition">
                              Save
                            </button>
                            <button onClick={() => setEditScore(null)} className="text-xs text-muted-foreground hover:text-muted-foreground transition">Cancel</button>
                          </div>
                        </div>
                      );
                    })()}

                    {isScheduling && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex gap-2">
                          <div>
                            <label className={labelCls}><MapPin className="w-3 h-3 inline mr-1" />Court</label>
                            {(function() {
                              const PRESETS = ["C1","C2","C3"];
                              const isPreset = PRESETS.includes(editSchedule!.court);
                              const isEmpty = editSchedule!.court === "";
                              const selectVal = isPreset ? editSchedule!.court : isEmpty ? "" : "other";
                              return (
                                <>
                                  <select
                                    value={selectVal}
                                    onChange={(e) => {
                                      if (e.target.value === "other") setEditSchedule((p) => p && ({ ...p, court: "​" }));
                                      else setEditSchedule((p) => p && ({ ...p, court: e.target.value }));
                                    }}
                                    className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                                  >
                                    <option value="">Select</option>
                                    <option value="C1">Court 1 (C1)</option>
                                    <option value="C2">Court 2 (C2)</option>
                                    <option value="C3">Court 3 (C3)</option>
                                    <option value="other">Other</option>
                                  </select>
                                  {!isPreset && !isEmpty && (
                                    <input
                                      value={editSchedule!.court === "​" ? "" : editSchedule!.court}
                                      onChange={(e) => setEditSchedule((p) => p && ({ ...p, court: e.target.value || "​" }))}
                                      placeholder="Enter court"
                                      className="mt-1 w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                                    />
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          <div className="flex-1">
                            <label className={labelCls}><CalendarDays className="w-3 h-3 inline mr-1" />Date & Time</label>
                            <input type="datetime-local" value={editSchedule!.at ? editSchedule!.at.slice(0, 16) : ""}
                              onChange={(e) => setEditSchedule((p) => p && ({ ...p, at: e.target.value }))}
                              className={inputCls} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveSchedule} className="px-4 py-1.5 rounded-xl bg-[var(--info)] hover:bg-[var(--info)] text-foreground text-xs font-black transition">Save</button>
                          <button onClick={() => setEditSchedule(null)} className="text-xs text-muted-foreground hover:text-muted-foreground transition">Cancel</button>
                        </div>
                      </div>
                    )}

                    {assignUmpire?.matchId === m.id && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div>
                          <label className={labelCls}><Users className="w-3 h-3 inline mr-1" />Assign Umpire</label>
                          <div className="mt-1">
                            <PlayerSelect
                              value={assignUmpire.umpireId}
                              onChange={(v) => setAssignUmpire(p => p ? { ...p, umpireId: v } : null)}
                              players={allPlayers ?? []}
                              placeholder="Select an umpire..."
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveUmpire} className="px-4 py-1.5 rounded-xl bg-[var(--info)] hover:bg-[var(--info)] text-foreground text-xs font-black transition">Save</button>
                          <button onClick={() => setAssignUmpire(null)} className="text-xs text-muted-foreground hover:text-muted-foreground transition">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}

      {showBulkSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-black text-slate-800 dark:text-foreground text-base">Bulk Schedule — {activeCategory}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">One match per line. Supported text formats:</p>
                <div className="mt-1 text-xs text-muted-foreground font-mono space-y-0.5">
                  <p>MS_QF_01: Court 3, 2026-06-30 10:00</p>
                  <p>MS_QF_02 court=4 date=2026-06-30 time=11:30</p>
                  <p>MS_SF_01, Court 1, 30/06/2026 14:00</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadScheduleTemplate}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-muted-foreground hover:text-[var(--info)] hover:border-[var(--info)] transition">
                  <Download className="w-3.5 h-3.5" /> CSV Template
                </button>
                <button onClick={() => setShowBulkSchedule(false)} className="text-muted-foreground hover:text-muted-foreground transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <textarea
              rows={7}
              placeholder={"MS_QF_01: Court 3, 2026-06-30 10:00\nMS_QF_02: Court 4, 2026-06-30 11:30\nMS_SF_01: Court 1, 2026-07-01 09:00"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className={`${inputCls} font-mono text-xs resize-none`}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={() => parseBulkSchedule(bulkText)}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-on-accent text-xs font-black transition">
                Preview
              </button>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-[var(--info)] transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV</span>
                <input type="file" accept=".csv" className="hidden"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleScheduleCSV(f); e.target.value = ""; }} />
              </label>
            </div>

            {bulkPreview.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-4 gap-0 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-black text-muted-foreground uppercase tracking-wider text-[10px]">
                  <span>Match</span><span>Court</span><span>Date & Time</span><span>Status</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {bulkPreview.map((row, i) => (
                    <div key={i} className={`grid grid-cols-4 gap-0 px-3 py-2 border-t border-slate-100 dark:border-slate-800 ${!row.found ? "bg-red-50 dark:bg-[var(--danger)]/20" : ""}`}>
                      <span className="font-bold text-muted-foreground dark:text-slate-300">{row.matchCode}</span>
                      <span className="text-muted-foreground dark:text-muted-foreground">{row.court || <span className="text-slate-300">—</span>}</span>
                      <span className="text-muted-foreground dark:text-muted-foreground">{row.at ? new Date(row.at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : <span className="text-slate-300">—</span>}</span>
                      <span className={row.found && !row.wrongCategory ? "text-primary font-bold" : "text-[var(--danger)] font-bold"}>
                        {!row.found ? "✗ Not found" : row.wrongCategory ? "⚠️ Wrong Category" : "✓ Found"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={saveBulkSchedule}
                disabled={bulkSaving || bulkPreview.length === 0 || bulkPreview.every((r) => !r.found)}
                className="px-5 py-2 rounded-xl bg-[var(--info)] hover:bg-[var(--info)] text-foreground text-xs font-black transition disabled:opacity-40 disabled:cursor-not-allowed">
                {bulkSaving ? "Saving…" : `Save ${bulkPreview.filter((r) => r.found).length} Match${bulkPreview.filter((r) => r.found).length !== 1 ? "es" : ""}`}
              </button>
              <button onClick={() => { setShowBulkSchedule(false); setBulkText(""); setBulkPreview([]); }}
                className="text-xs text-muted-foreground hover:text-muted-foreground transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
