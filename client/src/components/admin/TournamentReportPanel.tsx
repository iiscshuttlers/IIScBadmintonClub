import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { BarChart3, Clock, Download, FileText, Flag, Loader2, Medal, RefreshCw, Sparkles, Star, Trophy, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { computeReport, matchesToCsv, type ReportMatch, type TournamentReport } from "@/lib/tournamentReport";
import { summariseFeedback, type FeedbackSummary } from "@/lib/tournamentFeedback";

/**
 * Organizer wrap-up: headline numbers, results per category, highlights and
 * umpire tally for a tournament, with CSV (all matches) and PDF (summary) export.
 * Winners reach the public Winners Wall automatically once the tournament is
 * archived (useArchivedTournaments derives them from the Final/3rd-place rows).
 */

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";

const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

const fileSafe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "tournament";

async function saveFile(fileName: string, data: string, mime: string, isBase64 = false) {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data,
      directory: Directory.Cache,
      ...(isBase64 ? {} : { encoding: Encoding.UTF8 }),
    });
    await Share.share({ title: fileName, files: [uri], dialogTitle: "Save or share report" });
    return;
  }
  const blob = isBase64
    ? new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: mime })
    : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildPdf(name: string, r: TournamentReport, umpireNames: Record<string, string>, registered: number | null) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const left = 16;
  let y = 20;
  const line = (text: string, size = 11, bold = false, gap = 6) => {
    if (y > 280) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    for (const l of pdf.splitTextToSize(text, 178)) {
      pdf.text(l, left, y);
      y += gap;
    }
  };

  line("IISc Badminton Club", 10, true);
  line(`${name} — Wrap-up report`, 18, true, 9);
  line(`Generated ${new Date().toLocaleString("en-IN")}`, 9, false, 8);

  line("Summary", 13, true, 7);
  line(`Players: ${r.players}${registered != null ? ` (registered: ${registered})` : ""}`);
  line(`Matches: ${r.totalMatches} — completed ${r.completed}, walkovers ${r.walkovers}, remaining ${r.remaining}`);
  line(`Courts used: ${r.courtsUsed.join(", ") || "—"}`);
  line(`First match started: ${fmtDateTime(r.firstStart)} · Last match ended: ${fmtDateTime(r.lastEnd)}`);
  if (r.avgMatchMins) line(`Average match length: ${Math.round(r.avgMatchMins)} min`);
  line(`Total points played: ${r.totalPoints.toLocaleString("en-IN")}`, 11, false, 9);

  line("Results", 13, true, 7);
  for (const c of r.categories) {
    line(`${c.category} (${c.players} players, ${c.matches} matches)`, 11, true);
    if (c.winner) line(`   Champion: ${c.winner}`);
    if (c.runnerUp) line(`   Runner-up: ${c.runnerUp}`);
    if (c.third.length) line(`   Third: ${c.third.join(" / ")}`);
    if (!c.winner) line("   Final not yet played");
    y += 2;
  }

  if (r.highlights.length) {
    line("Highlights", 13, true, 7);
    for (const h of r.highlights) {
      line(`${h.label}: ${h.match.team1_label} vs ${h.match.team2_label} (${h.match.category}) — ${h.detail}${h.match.score ? `, ${h.match.score}` : ""}`);
    }
    y += 3;
  }

  if (r.umpires.length) {
    line("Officials", 13, true, 7);
    for (const u of r.umpires) line(`${umpireNames[u.id] ?? "Umpire"}: ${u.matches} match${u.matches === 1 ? "" : "es"}`);
  }
  return pdf;
}

export function TournamentReportPanel({
  tournament,
}: {
  tournament: { id: string; name: string; require_app_registration?: boolean | null };
}) {
  const [matches, setMatches] = useState<ReportMatch[]>([]);
  const [umpireNames, setUmpireNames] = useState<Record<string, string>>({});
  const [registered, setRegistered] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournament_matches")
      .select(
        "id, match_code, category, round, round_name, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id, status, score, sets_history, winner_side, court_number, scheduled_at, started_at, ended_at, umpired_by",
      )
      .eq("tournament_id", tournament.id)
      .order("category", { ascending: true })
      .order("round", { ascending: true })
      .order("match_number", { ascending: true });
    if (error) {
      console.error("report load failed", error);
      setLoadError(true);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as ReportMatch[];
    setMatches(rows);
    setLoadError(false);

    const umpIds = Array.from(new Set(rows.map((m) => m.umpired_by).filter(Boolean))) as string[];
    if (umpIds.length) {
      const { data: ump } = await supabase.from("players").select("id, full_name").in("id", umpIds);
      setUmpireNames(Object.fromEntries((ump ?? []).map((p: any) => [p.id, p.full_name])));
    }
    // tournament_feedback is new; generated types catch up after `supabase db push`.
    const { data: fb } = await (supabase as any)
      .from("tournament_feedback")
      .select("rating, tags, comment")
      .eq("tournament_id", tournament.id);
    setFeedback(fb ? summariseFeedback(fb) : null);

    if (tournament.require_app_registration) {
      const { count } = await supabase
        .from("tournament_registrations")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournament.id)
        .eq("status", "approved");
      setRegistered(count ?? null);
    } else {
      setRegistered(null);
    }
    setLoading(false);
  }, [tournament.id, tournament.require_app_registration]);

  useEffect(() => {
    load();
  }, [load]);

  const report = useMemo(() => computeReport(matches), [matches]);

  const exportCsv = async () => {
    setExporting("csv");
    try {
      await saveFile(`${fileSafe(tournament.name)}-matches.csv`, matchesToCsv(matches, umpireNames), "text/csv;charset=utf-8");
    } catch (e: any) {
      if (!/cancel/i.test(e?.message ?? "")) toast.error("Couldn't export CSV");
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const pdf = buildPdf(tournament.name, report, umpireNames, registered);
      await saveFile(
        `${fileSafe(tournament.name)}-report.pdf`,
        pdf.output("datauristring").split(",")[1],
        "application/pdf",
        true,
      );
    } catch (e: any) {
      if (!/cancel/i.test(e?.message ?? "")) toast.error("Couldn't export PDF");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className={`${cardCls} flex items-center justify-center py-10`}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-label="Loading report" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${cardCls} text-center py-8`}>
        <p className="text-sm text-muted-foreground mb-3">Couldn't load this tournament's matches.</p>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-primary">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const stats = [
    { icon: Users, label: "Players", value: report.players, sub: registered != null ? `${registered} registered` : undefined },
    { icon: BarChart3, label: "Matches", value: report.completed + report.walkovers, sub: `of ${report.totalMatches}` },
    { icon: Flag, label: "Walkovers", value: report.walkovers },
    { icon: Clock, label: "Avg length", value: report.avgMatchMins ? `${Math.round(report.avgMatchMins)}m` : "—" },
  ];

  return (
    <div className="space-y-5">
      <div className={cardCls}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-foreground">Wrap-up report</h3>
              <p className="text-xs text-muted-foreground">
                {report.remaining > 0
                  ? `${report.remaining} match${report.remaining === 1 ? "" : "es"} still to play — figures will update.`
                  : "All matches done. Winners appear on the Winners Wall once you archive the event."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!!exporting || matches.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {exporting === "csv" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              CSV
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={!!exporting || matches.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-bold disabled:opacity-50"
            >
              {exporting === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              PDF
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                <s.icon className="w-3.5 h-3.5" /> {s.label}
              </div>
              <div className="mt-1 text-2xl font-black tabular-nums text-slate-800 dark:text-foreground">{s.value}</div>
              {s.sub && <div className="text-[11px] text-muted-foreground">{s.sub}</div>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Courts {report.courtsUsed.join(", ") || "—"} · {fmtDateTime(report.firstStart)} → {fmtDateTime(report.lastEnd)} ·{" "}
          {report.totalPoints.toLocaleString("en-IN")} points played
        </p>
      </div>

      <div className={cardCls}>
        <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-foreground mb-3">
          <Trophy className="w-4 h-4 text-amber-500" /> Results
        </h4>
        {report.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {report.categories.map((c) => (
              <div key={c.category} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  <span className="flex items-center gap-1.5"><Medal className="w-3.5 h-3.5" /> {c.category}</span>
                  <span className="text-muted-foreground font-bold normal-case">{c.players} players</span>
                </div>
                {c.winner ? (
                  <div className="mt-2 space-y-0.5 text-sm">
                    <p className="font-bold text-slate-800 dark:text-foreground">🥇 {c.winner}</p>
                    {c.runnerUp && <p className="text-muted-foreground">🥈 {c.runnerUp}</p>}
                    {c.third.length > 0 && <p className="text-muted-foreground">🥉 {c.third.join(" / ")}</p>}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Final not played yet</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {feedback && (
        <div className={cardCls}>
          <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-foreground mb-3">
            <Star className="w-4 h-4 text-amber-500" /> Player feedback
          </h4>
          {feedback.count === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ratings yet. Players get a "How was it?" push two hours after you mark the tournament completed.
            </p>
          ) : (
            <div className="grid sm:grid-cols-[auto_1fr] gap-5">
              <div className="text-center">
                <div className="text-4xl font-black tabular-nums">{feedback.average!.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">{feedback.count} rating{feedback.count === 1 ? "" : "s"}</div>
                <div className="mt-2 space-y-0.5">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <div key={n} className="flex items-center gap-1.5 text-[11px] tabular-nums">
                      <span className="w-3">{n}</span>
                      <div className="w-24 h-1.5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${(feedback.distribution[n - 1] / feedback.count) * 100}%` }} />
                      </div>
                      <span className="w-4 text-muted-foreground">{feedback.distribution[n - 1]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3 min-w-0">
                {feedback.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {feedback.tags.map((t) => (
                      <span key={t.tag} className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                        {t.tag} · {t.count}
                      </span>
                    ))}
                  </div>
                )}
                {feedback.comments.length > 0 && (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                    {feedback.comments.map((c, i) => (
                      <li key={i} className="text-sm text-slate-700 dark:text-slate-300 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(report.highlights.length > 0 || report.umpires.length > 0) && (
        <div className="grid md:grid-cols-2 gap-5">
          {report.highlights.length > 0 && (
            <div className={cardCls}>
              <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-foreground mb-3">
                <Sparkles className="w-4 h-4 text-violet-500" /> Highlights
              </h4>
              <ul className="space-y-2">
                {report.highlights.map((h) => (
                  <li key={h.label} className="text-sm">
                    <span className="font-bold text-slate-800 dark:text-foreground">{h.label}</span>
                    <span className="text-muted-foreground"> · {h.detail}</span>
                    <div className="text-xs text-muted-foreground truncate">
                      {h.match.category}: {h.match.team1_label} vs {h.match.team2_label}
                      {h.match.score ? ` — ${h.match.score}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.umpires.length > 0 && (
            <div className={cardCls}>
              <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-foreground mb-3">
                <Flag className="w-4 h-4 text-emerald-500" /> Officials
              </h4>
              <ul className="space-y-1.5">
                {report.umpires.map((u) => (
                  <li key={u.id} className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-200">{umpireNames[u.id] ?? "Umpire"}</span>
                    <span className="font-bold tabular-nums">{u.matches}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
