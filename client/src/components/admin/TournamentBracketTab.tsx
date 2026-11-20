import React, { useState, useEffect, useCallback } from "react";
import { tournamentService } from "@/services/tournamentService";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { usePlayers } from "@/hooks/usePlayers";
import { BracketVisual } from "@/components/tournament/BracketVisual";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  Loader2, Swords, Download, FileText, Camera, CalendarDays, RefreshCw, SkipForward
} from "lucide-react";
import { syncBracketNames } from "@/lib/bracketSync";
import { exportToImage, exportToPDF } from "@/utils/exportUtils";
import { themeColorFor, withAlpha, type ThemeColorToken } from "@/lib/themeColors";
import { downloadCSV } from "@/utils/csvUtils";
import { TournamentMatchesTab } from "./TournamentMatchesTab";
import type { Tournament, TournamentMatch, RoundRule } from "@/types/tournament";

const cardCls = "bg-card rounded-2xl border border-border p-5 shadow-sm";

export interface TournamentBracketTabProps {
  tournament: Tournament;
  isMasterAdmin: boolean;
}

export function TournamentBracketTab({ tournament, isMasterAdmin }: TournamentBracketTabProps) {
  const { confirm } = useConfirm();
  const { session } = useAuth();
  const { data: allPlayers } = usePlayers();
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [_roundRules, setRoundRules] = useState<RoundRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleDate, setScheduleDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [activeCategory, setActiveCategory] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    const parts = hash.split("/");
    const cats = tournament.categories || [];
    if (parts[1] === "bracket" && parts[2]) {
      return cats.includes(parts[2]) ? parts[2] : (cats[0] ?? "");
    }
    return cats[0] ?? "";
  });
  const [viewMode, setViewMode] = useState<"list" | "visual">(() => {
    const hash = window.location.hash.replace("#", "");
    const parts = hash.split("/");
    if (parts[1] === "bracket" && parts[3]) {
      return parts[3] === "list" ? "list" : "visual";
    }
    return "visual";
  });
  const [showBulkSchedule, setShowBulkSchedule] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mData, rData] = await Promise.all([
        tournamentService.fetchTournamentMatches(tournament.id),
        tournamentService.fetchTournamentRoundRules(tournament.id),
      ]);
      setMatches(mData ?? []);
      setRoundRules(rData ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load bracket data");
    } finally {
      setLoading(false);
    }
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeCategory) {
      const hash = window.location.hash.replace("#", "");
      const baseHash = hash.split("/")[0] || "tournament";
      window.history.replaceState(null, "", `#${baseHash}/bracket/${activeCategory}/${viewMode}`);
    }
  }, [activeCategory, viewMode]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      const parts = hash.split("/");
      const cats = tournament.categories || [];
      if (parts[1] === "bracket") {
        if (parts[2] && cats.includes(parts[2])) setActiveCategory(parts[2]);
        if (parts[3] === "list" || parts[3] === "visual") setViewMode(parts[3] as "list" | "visual");
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [tournament.categories]);

  const batchAdvance = async () => {
    let advanced = 0;

    const pendingByes = matches.filter((m) => 
      (m.status === "scheduled" || m.status === "in_progress") &&
      (m.team1_label === "BYE" || m.team2_label === "BYE")
    );
    for (const m of pendingByes) {
      let winningSide: 0 | 1 | 2 = 0;
      if (m.team1_label === "BYE" && m.team2_label !== "BYE") winningSide = 2;
      else if (m.team2_label === "BYE" && m.team1_label !== "BYE") winningSide = 1;
      
      try {
        await tournamentService.recordTournamentWalkover({
          p_match_id: m.id,
          p_winner_side: winningSide,
          p_umpire_id: null,
        });
        advanced++;
      } catch {
        // continue
      }
    }

    const completed = matches.filter((m) => (m.status === "completed" || m.status === "walkover") && m.advances_to_match);
    for (const m of completed) {
      try {
        await tournamentService.advanceTournamentWinner(m.id);
        advanced++;
      } catch {
        // continue
      }
    }
    
    await load();
    toast.success(`Batch advanced (${advanced} actions applied)`);
  };

  const downloadMatchesPDF = async (cat: string) => {
    const catMatches = matches.filter((m) => m.category === cat);
    if (!catMatches.length) {
      toast.error("No matches to export");
      return;
    }

    const header = [
      "Match Code",
      "Round",
      "Court",
      "Schedule",
      "Team 1",
      "Team 2",
      "Status",
      "Score / Result"
    ];

    const rows = catMatches.map((m) => {
      const scheduleStr = m.scheduled_at
        ? new Date(m.scheduled_at).toLocaleString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD";

      const courtStr = m.court_number ? `Court ${m.court_number}` : "-";
      
      let scoreStr = "-";
      if (m.status === "walkover") {
        scoreStr = `W/O (${m.winner_side === 1 ? m.team1_label : m.team2_label})`;
      } else if (m.sets_history && m.sets_history.length > 0) {
        scoreStr = m.sets_history.join(", ");
      } else if (m.score) {
        scoreStr = m.score;
      }

      return [
        m.match_code || "",
        m.round_name || `Round ${m.round}`,
        courtStr,
        scheduleStr,
        m.team1_label || "TBD",
        m.team2_label || "TBD",
        (m.status || "pending").toUpperCase(),
        scoreStr
      ];
    });

    const sheetName = `${tournament.name} - ${cat} Matches`;
    const filename = `${tournament.name.replace(/\s+/g, '_')}_${cat}_matches`;
    await exportToPDF([{ name: sheetName, data: [header, ...rows] }], filename);
  };

  const printDailySchedulePDF = async () => {
    const dateMatches = matches.filter(m => {
      if (!m.scheduled_at) return false;
      const mDate = new Date(m.scheduled_at).toISOString().split("T")[0];
      return mDate === scheduleDate;
    });

    if (!dateMatches.length) {
      toast.error(`No matches scheduled for ${scheduleDate}`);
      return;
    }

    dateMatches.sort((a, b) => {
      const catA = a.category || "";
      const catB = b.category || "";
      if (catA !== catB) return catA.localeCompare(catB);
      const timeA = new Date(a.scheduled_at!).getTime();
      const timeB = new Date(b.scheduled_at!).getTime();
      if (timeA !== timeB) return timeA - timeB;
      const courtA = a.court_number || "";
      const courtB = b.court_number || "";
      return courtA.localeCompare(courtB);
    });

    const header = [
      "Sr. No", "Category", "Time", "Court", "Match", "Round", "Team 1", "Team 2", "Score / Result"
    ];

    const rows = dateMatches.map((m, idx) => {
      const scheduleStr = new Date(m.scheduled_at!).toLocaleString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });

      let scoreStr = "-";
      if (m.status === "walkover") {
        scoreStr = `W/O (${m.winner_side === 1 ? m.team1_label : m.team2_label})`;
      } else if (m.sets_history && m.sets_history.length > 0) {
        scoreStr = m.sets_history.join(", ");
      } else if (m.score) {
        scoreStr = m.score;
      }

      return [
        (idx + 1).toString(),
        m.category,
        scheduleStr,
        m.court_number ? `Court ${m.court_number}` : "-",
        m.match_code || "",
        m.round_name || `Round ${m.round}`,
        m.team1_label || "TBD",
        m.team2_label || "TBD",
        scoreStr
      ];
    });

    const sheetName = `Schedule - ${scheduleDate}`;
    const filename = `${tournament.name.replace(/\s+/g, '_')}_schedule_${scheduleDate}`;
    // The PDF is printed on white paper, so resolve colours from the light "paper" theme.
    const paperCard = themeColorFor("paper", "card");
    const paperInk = themeColorFor("paper", "foreground");
    const categoryTint = (token: ThemeColorToken) => withAlpha(themeColorFor("paper", token), 0.07);
    const categoryBg: Record<string, string> = {
      MS: categoryTint("cat-ms"),
      WS: categoryTint("cat-ws"),
      MD: categoryTint("cat-md"),
      WD: categoryTint("cat-wd"),
      XD: categoryTint("cat-xd"),
    };
    const cellStyler = (row: any[], _rowIndex: number, colIndex: number) => {
      const cat = row[1];
      const bgColor = categoryBg[cat] ?? paperCard;
      
      let style = `background-color: ${bgColor};`;
      if (colIndex === 0 || colIndex === 1 || colIndex === 4 || colIndex === 6 || colIndex === 7) {
        style += ` font-weight: 600; color: ${paperInk};`;
      }
      return style;
    };

    await exportToPDF([{ name: sheetName, data: [header, ...rows], cellStyler }], filename);
  };

  const printDailyScheduleImage = async () => {
    const dateMatches = matches.filter(m => {
      if (!m.scheduled_at) return false;
      return new Date(m.scheduled_at).toISOString().split("T")[0] === scheduleDate;
    });
    if (!dateMatches.length) { toast.error(`No matches scheduled for ${scheduleDate}`); return; }

    dateMatches.sort((a, b) => {
      const catA = a.category || "", catB = b.category || "";
      if (catA !== catB) return catA.localeCompare(catB);
      const timeA = new Date(a.scheduled_at!).getTime(), timeB = new Date(b.scheduled_at!).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.court_number || "").localeCompare(b.court_number || "");
    });

    const header = ["Sr. No", "Category", "Time", "Court", "Match", "Round", "Team 1", "Team 2", "Score / Result"];
    const rows = dateMatches.map((m, idx) => {
      const scheduleStr = new Date(m.scheduled_at!).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" });
      let scoreStr = "-";
      if (m.status === "walkover") scoreStr = `W/O (${m.winner_side === 1 ? m.team1_label : m.team2_label})`;
      else if (m.sets_history?.length) scoreStr = m.sets_history.join(", ");
      else if (m.score) scoreStr = m.score;
      return [(idx + 1).toString(), m.category, scheduleStr, m.court_number ? `Court ${m.court_number}` : "-", m.match_code || "", m.round_name || `Round ${m.round}`, m.team1_label || "TBD", m.team2_label || "TBD", scoreStr];
    });

    const sheetName = `Schedule - ${scheduleDate}`;
    const filename = `${tournament.name.replace(/\s+/g, '_')}_schedule_${scheduleDate}`;
    await exportToImage([{ name: sheetName, data: [header, ...rows] }], filename);
  };

  const downloadMatchesCSV = (cat: string) => {
    const catMatches = matches.filter((m) => m.category === cat);
    if (!catMatches.length) {
      toast.error("No matches to export");
      return;
    }

    const header = [
      "Match Code", "Round", "Court", "Scheduled Time", "Team 1", "Team 2", "Status", "Score / Result"
    ];

    const rows = catMatches.map((m) => {
      const scheduleStr = m.scheduled_at
        ? new Date(m.scheduled_at).toLocaleString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD";

      const courtStr = m.court_number ? `Court ${m.court_number}` : "";
      let scoreStr = "";
      if (m.status === "walkover") {
        scoreStr = `W/O (${m.winner_side === 1 ? m.team1_label : m.team2_label})`;
      } else if (m.sets_history && m.sets_history.length > 0) {
        scoreStr = m.sets_history.join(", ");
      } else if (m.score) {
        scoreStr = m.score;
      }

      return [
        m.match_code || "",
        m.round_name || `Round ${m.round}`,
        courtStr,
        scheduleStr,
        m.team1_label || "TBD",
        m.team2_label || "TBD",
        (m.status || "pending").toUpperCase(),
        scoreStr
      ];
    });

    downloadCSV(`${tournament.name.replace(/\s+/g, '_')}_${cat}_matches_list.csv`, [header, ...rows]);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!matches.length) return (
    <div className={`${cardCls} text-center py-10`}>
      <Swords className="w-10 h-10 text-soft mx-auto mb-3" />
      <p className="text-muted-foreground font-bold">No bracket yet. Go to Participants tab and click Generate Bracket.</p>
    </div>
  );

  const categoryMatches = matches.filter((m) => m.category === activeCategory);
  const rounds = [...new Set(categoryMatches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {/* Category tabs + batch actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(tournament.categories || []).map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-xl text-sm font-black transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-card border border-border text-soft hover:border-primary"}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          {/* Visual / List switch */}
          <div className="flex rounded-xl border border-border-strong overflow-hidden text-xs font-black w-full">
            <button onClick={() => setViewMode("visual")}
              className={`flex-1 px-3 py-1.5 transition ${viewMode === "visual" ? "bg-muted text-on-accent" : "text-muted-foreground hover:text-soft"}`}>
              Visual
            </button>
            <button onClick={() => setViewMode("list")}
              className={`flex-1 px-3 py-1.5 transition ${viewMode === "list" ? "bg-muted text-on-accent" : "text-muted-foreground hover:text-soft"}`}>
              List
            </button>
          </div>

          {/* Export PDF / CSV */}
          <div className="flex gap-2 w-full">
            <button onClick={() => downloadMatchesPDF(activeCategory)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-danger text-xs font-black text-danger hover:bg-danger/30 transition">
              <FileText className="w-3.5 h-3.5 shrink-0" /> Export PDF
            </button>
            <button onClick={() => downloadMatchesCSV(activeCategory)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-success text-xs font-black text-success hover:bg-success/30 transition">
              <Download className="w-3.5 h-3.5 shrink-0" /> Export CSV
            </button>
          </div>

          {/* Daily Schedule Print */}
          <div className="flex gap-2 w-full items-center bg-card/50 p-2 rounded-xl border border-border">
            <input 
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-border-strong bg-background text-xs font-bold w-32 focus:outline-none focus:ring-2 focus:ring-primary/50 text-soft"
            />
            <button onClick={printDailySchedulePDF}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-info/10 text-info hover:bg-info/20 border border-info/40 text-xs font-black transition">
              <FileText className="w-3.5 h-3.5 shrink-0" /> PDF
            </button>
            <button onClick={printDailyScheduleImage}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 border border-success/40 text-xs font-black transition">
              <Camera className="w-3.5 h-3.5 shrink-0" /> PNG
            </button>
          </div>

          {/* Admin Actions */}
          <div className="flex flex-wrap gap-2 w-full">
            <button onClick={() => setShowBulkSchedule(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-info text-xs font-black text-info hover:bg-info/30 transition min-w-[120px]">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" /> Bulk Schedule
            </button>
            <button 
              disabled={isSyncing}
              onClick={async () => {
                const ok = await confirm({
                  title: "Sync Bracket Names",
                  description: "This will synchronize Round 1 bracket match names with the latest Participants list. Continue?",
                  confirmLabel: "Sync Names",
                  confirmVariant: "primary",
                });
                if (!ok) return;
                setIsSyncing(true);
                try {
                  let result;
                  try {
                    result = await syncBracketNames({
                      tournamentId: tournament.id,
                      category: activeCategory,
                      onlyScheduled: false,
                      resolvePlayerName: (id) => allPlayers?.find((pl) => pl.id === id)?.full_name,
                    });
                  } catch (err: any) {
                    toast.error(err?.message ?? "Failed to sync names");
                    return;
                  }
                  if (result.invalidDraw) { toast.error("Manual entry rounds don't fit the draw"); return; }
                  toast.success(`Synced ${result.updated} participant names`);
                  
                  const completed = matches.filter((m) => (m.status === "completed" || m.status === "walkover") && m.advances_to_match);
                  if (completed.length > 0) {
                    toast.info("Cascading name updates to advanced rounds...");
                    for (const m of completed) {
                      await tournamentService.advanceTournamentWinner(m.id);
                    }
                  }
                  load();
                } finally { 
                  setIsSyncing(false); 
                }
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-warning text-xs font-black text-warning hover:bg-warning/30 transition min-w-[120px] disabled:opacity-50">
              {isSyncing ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 shrink-0" />} Sync Names
            </button>
            <button 
              disabled={isAdvancing}
              onClick={async () => {
                setIsAdvancing(true);
                try { await batchAdvance(); } finally { setIsAdvancing(false); }
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-individual hover:bg-individual/90 text-on-accent text-xs font-black transition min-w-[120px] disabled:opacity-50">
              {isAdvancing ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <SkipForward className="w-3.5 h-3.5 shrink-0" />} Batch Advance
            </button>
          </div>
        </div>
      </div>

      {/* Visual bracket */}
      {viewMode === "visual" && (
        <ErrorBoundary>
          <BracketVisual matches={categoryMatches} rounds={rounds} category={activeCategory} enablePathHighlight />
        </ErrorBoundary>
      )}

      {/* Match cards by round */}
      {viewMode === "list" && (
        <TournamentMatchesTab
          tournament={tournament}
          matches={matches}
          activeCategory={activeCategory}
          isMasterAdmin={isMasterAdmin}
          allPlayers={allPlayers}
          load={load}
          setMatches={setMatches}
          confirm={confirm}
          session={session}
          showBulkSchedule={showBulkSchedule}
          setShowBulkSchedule={setShowBulkSchedule}
        />
      )}
    </div>
  );
}
