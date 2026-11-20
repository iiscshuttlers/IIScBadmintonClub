import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { tournamentService } from "@/services/tournamentService";
import { adminService } from "@/services/adminService";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import {
  Save, Trash2, Check, ChevronRight, Undo2, Users, GripVertical, Loader2, ClipboardList, Bell, Clock, ShieldCheck, ShieldAlert, X, AlertTriangle,
  ListChecks, Gauge, Settings2
} from "lucide-react";
import { ScoringRulesPanel } from "@/components/tournament/ScoringRulesPanel";
import { TournamentOfficialsPanel } from "./TournamentOfficialsPanel";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { calculateMinRosterRequirements } from "@/lib/teamLineupRules";
import type { Tournament } from "@/types/tournament";
import type { LifecycleReadinessReport } from "@/lib/tournamentReadiness";

const cardCls = "bg-card rounded-2xl border border-border p-5 shadow-sm";
const inputCls = "w-full px-3 py-2.5 rounded-xl border border-border-strong bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";
const CATEGORIES = ["MS", "WS", "MD", "WD", "XD"];

/** Readiness checks name the old tab ids; label them by where they live now. */
const FIX_LABEL: Record<string, string> = {
  setup: "Setup",
  participants: "Players",
  teams: "Teams",
  bracket: "Draw",
  fixtures: "Draw",
  rules: "Scoring rules",
  schedule: "Schedule",
  officials: "Officials",
};

const toLocalDatetimeStr = (isoStr: string | null) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

export interface TournamentSettingsTabProps {
  tournament: Tournament;
  onGoArchive?: () => void;
  onSaved: (t: Tournament) => void;
  isMasterAdmin: boolean;
  onDelete?: () => void;
  onNavigateTab?: (tab: string) => void;
  /** open and scroll to one of the collapsed sections (deep links, readiness fixes) */
  focusSection?: "team" | "rules" | "officials" | "more";
}

export function TournamentSettingsTab({
  tournament,
  onSaved,
  isMasterAdmin,
  onDelete,
  onGoArchive,
  onNavigateTab,
  focusSection,
}: TournamentSettingsTabProps) {
  const [form, setForm] = useState<Tournament>({ ...tournament });
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [readinessReport, setReadinessReport] = useState<LifecycleReadinessReport | null>(null);
  const [readinessModalOpen, setReadinessModalOpen] = useState(false);
  const { session } = useAuth();
  const { recordAction } = useAdminHistory();
  const { confirm } = useConfirm();

  const [draggedRubberIndex, setDraggedRubberIndex] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setForm({ ...tournament }); }, [tournament.id]);

  const upd = <K extends keyof Tournament>(k: K, v: Tournament[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setIsDirty(true);
  };

  useEffect(() => {
    if (!isDirty) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      save(true);
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [form, isDirty]);

  const save = async (isAutosave = false) => {
    if (form.start_date && form.end_date) {
      if (new Date(form.start_date) > new Date(form.end_date)) {
        setSaveError("Start date is after the end date");
        if (!isAutosave) toast.error("Start date cannot be after the end date.");
        return;
      }
    }
    
    setSaving(true);
    const { id, created_at, archived_at, slug, ...rest } = form;
    
    // Sanitize empty strings to null for date columns
    if (rest.start_date === "") rest.start_date = null;
    if (rest.end_date === "") rest.end_date = null;
    if (rest.form_close_date === "") rest.form_close_date = null;

    if (rest.format_family !== "TEAM") {
      rest.tie_format_config = null;
    }

    try {
      const data = await tournamentService.updateTournamentAndReturn(id, rest);
      if (!isAutosave) {
        await adminService.logAction(
          `Updated tournament "${form.name}" (${form.status})`,
          null,
          session?.user?.email ?? "admin"
        );
        toast.success("Saved");
      }
      setIsDirty(false);
      setSaveError(null);
      onSaved(data as Tournament);
      setSaving(false);
    } catch (err: any) {
      setSaveError("Couldn't save");
      if (!isAutosave) toast.error(err.message || "Could not save tournament");
      setSaving(false);
      return;
    }
  };

  const transition = async (newStatus: string) => {
    const statusLabel = newStatus === "active" ? "Live" : newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

    if (newStatus === "active") {
      setTransitioning(true);
      try {
        const report = await tournamentService.verifyTournamentReadiness(tournament.id, "start_play");
        if (!report.allowed) {
          setReadinessReport(report);
          setReadinessModalOpen(true);
          setTransitioning(false);
          toast.error("Tournament is not ready to go live", {
            description: `Found ${report.blockers.length} setup blocker(s). Please review and resolve them.`,
            duration: 8000,
          });
          return;
        }
      } catch (err: any) {
        console.warn("Readiness pre-check warning:", err);
      } finally {
        setTransitioning(false);
      }
    }

    const ok = await confirm({ title: "Confirm Status Change", description: `Move tournament to ${statusLabel}?`, confirmLabel: "Move", confirmVariant: "primary" });
    if (!ok) return;

    setTransitioning(true);
    let data: Tournament;
    try {
      if (newStatus === "active") {
        await tournamentService.transitionTournamentLifecycle(tournament.id, "start_play");
        data = await tournamentService.fetchTournamentById(tournament.id);
      } else {
        data = await tournamentService.updateTournamentAndReturn(tournament.id, { status: newStatus });
      }
    } catch (err: any) {
      const message = err?.message || "Could not change status";
      if (message.includes("tournament_not_ready:") || message.includes("Cannot start_play")) {
        try {
          const report = await tournamentService.verifyTournamentReadiness(tournament.id, "start_play");
          setReadinessReport(report);
          setReadinessModalOpen(true);
        } catch {
          // ignore
        }
        toast.error("Tournament is not ready to go active", {
          description: message.split("tournament_not_ready:")[1]?.trim() || message,
          duration: 8000,
        });
      } else {
        toast.error(message);
      }
      setTransitioning(false);
      return;
    }
    await recordAction({
      action_type: "update",
      entity_type: "tournaments",
      entity_id: tournament.id,
      before_state: tournament,
      after_state: data,
      label: `Changed tournament "${tournament.name}" status to ${newStatus}`,
    });
    toast.success(`Status → ${statusLabel}`);
    setForm((f) => ({ ...f, status: (data as Tournament).status }));
    onSaved(data as Tournament);
    setTransitioning(false);
  };

  const trashTournament = async () => {
    const live = form.status === "active";
    const ok = await confirm({
      title: "Move to trash?",
      description: live
        ? `"${form.name}" is live. Players will stop seeing it. You can restore it from Trash in the ⋯ menu.`
        : `You can restore "${form.name}" from Trash in the ⋯ menu.`,
      confirmLabel: "Move to trash",
      confirmVariant: "danger",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await tournamentService.updateTournament(tournament.id, { status: "deleted" });
    } catch (err: any) {
      toast.error("Failed to trash: " + (err.message || "Error"));
      setSaving(false);
      return;
    }
    await recordAction({
      action_type: "update",
      entity_type: "tournaments",
      entity_id: tournament.id,
      before_state: tournament,
      after_state: { ...tournament, status: "deleted" },
      label: `Sent tournament "${form.name}" to Trash`,
    });
    toast.success("Moved to trash");
    setSaving(false);
    onDelete?.();
  };

  const autoLabelRubbers = (config: any[]) => {
    const totals: Record<string, number> = {};
    config.forEach(r => {
      const cat = r.category || 'MS';
      totals[cat] = (totals[cat] || 0) + 1;
    });

    const counts: Record<string, number> = {};
    return config.map((r, idx) => {
      const cat = r.category || 'MS';
      counts[cat] = (counts[cat] || 0) + 1;
      const isDefaultLabel = !r.label || /^Rubber \d+$/.test(r.label) || /^[A-Z]{2}\s*\d*$/.test(r.label) || /^[A-Z]{2}$/.test(r.label);
      if (isDefaultLabel) {
        r.label = totals[cat] === 1 ? cat : `${cat} ${counts[cat]}`;
      }
      r.order = idx + 1;
      return r;
    });
  };

  const getRubbersList = (config: any): any[] => {
    if (!config) return [];
    if (Array.isArray(config)) return config;
    if (Array.isArray(config.rubbers)) return config.rubbers;
    return [];
  };

  const updateRubbersList = (newRubbers: any[]) => {
    if (form.tie_format_config && typeof form.tie_format_config === 'object' && !Array.isArray(form.tie_format_config)) {
      upd("tie_format_config", { ...form.tie_format_config, rubbers: newRubbers });
    } else {
      upd("tie_format_config", newRubbers);
    }
  };

  const categoriesCount = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = getRubbersList(form.tie_format_config).filter((r: any) => r.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  const addOfCategory = (cat: string) => {
    const list = getRubbersList(form.tie_format_config);
    const newConfig = [...list];
    newConfig.push({ order: newConfig.length + 1, label: '', category: cat, points: 1 });
    updateRubbersList(autoLabelRubbers(newConfig));
  };

  const removeLastOfCategory = (cat: string) => {
    const list = getRubbersList(form.tie_format_config);
    const newConfig = [...list];
    let index = -1;
    for (let i = newConfig.length - 1; i >= 0; i--) {
      if (newConfig[i].category === cat) {
        index = i;
        break;
      }
    }
    if (index !== -1) {
      newConfig.splice(index, 1);
      updateRubbersList(autoLabelRubbers(newConfig));
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedRubberIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, _index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedRubberIndex === null || draggedRubberIndex === dropIndex) return;

    const list = getRubbersList(form.tie_format_config);
    const newConfig = [...list];
    const item = newConfig.splice(draggedRubberIndex, 1)[0];
    newConfig.splice(dropIndex, 0, item);
    
    updateRubbersList(autoLabelRubbers(newConfig));
    setDraggedRubberIndex(null);
  };

  const rubbers = getRubbersList(form.tie_format_config);
  const isTeam = form.format_family === "TEAM";

  return (
    <div className="space-y-5">
      {/* Status: Draft → Live → Completed → Archived */}
      <div className={cardCls}>
        {(() => {
          const STEPS = [
            { key: "draft", label: "Draft", hint: "Only admins can see it" },
            { key: "active", label: "Live", hint: "Visible to players" },
            { key: "completed", label: "Completed", hint: "Results final" },
            { key: "archived", label: "Archived", hint: "Saved to Legacy" },
          ];
          const idx = Math.max(0, STEPS.findIndex((s) => s.key === form.status));
          const next = STEPS[idx + 1];
          const prev = idx > 0 ? STEPS[idx - 1] : null;
          const goNext = () => (next?.key === "archived" ? onGoArchive?.() : next && transition(next.key));
          return (
            <>
              <ol className="flex items-center gap-1 sm:gap-2" aria-label="Tournament status">
                {STEPS.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0" aria-current={i === idx ? "step" : undefined}>
                    <span className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-black ${i < idx ? "bg-success text-success-foreground" : i === idx ? "bg-primary text-primary-foreground ring-4 ring-primary/25" : "bg-muted text-muted-foreground"}`}>
                      {i < idx ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-black truncate ${i === idx ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                      <span className="hidden sm:block text-[10px] text-muted-foreground truncate">{s.hint}</span>
                    </span>
                    {i < STEPS.length - 1 && <span className={`flex-1 h-0.5 min-w-2 rounded ${i < idx ? "bg-success" : "bg-border"}`} />}
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {next && (
                    <button onClick={goNext} disabled={transitioning}
                      className="px-4 py-2 text-sm font-black rounded-xl bg-primary text-primary-foreground disabled:opacity-50 inline-flex items-center gap-1.5 transition">
                      {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                      {next.key === "active" ? "Go live" : next.key === "completed" ? "Mark completed" : "Archive to Legacy"}
                    </button>
                  )}
                  {prev && (
                    <button onClick={() => transition(prev.key)} disabled={transitioning}
                      className="px-3 py-2 text-xs font-bold rounded-xl border border-border text-muted-foreground hover:text-foreground disabled:opacity-50 inline-flex items-center gap-1.5 transition">
                      <Undo2 className="w-3.5 h-3.5" /> Back to {prev.label}
                    </button>
                  )}
                </div>
                {form.status === "draft" && (
                  <Link
                    href={`/tournament-setup/${tournament.id}`}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl border border-border text-soft hover:border-primary inline-flex items-center gap-1.5 transition"
                  >
                    <ListChecks className="w-3.5 h-3.5 text-primary" />
                    What's left before going live?
                  </Link>
                )}
              </div>
            </>
          );
        })()}
      </div>

      {readinessModalOpen && readinessReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-media/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${readinessReport.allowed ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                  {readinessReport.allowed ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    {readinessReport.action === "announce"
                      ? "Announcement Readiness"
                      : readinessReport.action === "publish_draw"
                      ? "Draw Publication Readiness"
                      : "Live Play Readiness"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {readinessReport.allowed
                      ? "All required setup gates passed! Tournament can transition."
                      : `${readinessReport.blockers.length} blocker(s) preventing transition.`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReadinessModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {readinessReport.blockers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-danger">
                  Required Fixes ({readinessReport.blockers.length})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {readinessReport.blockers.map((b, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-2xl border border-danger/30 bg-danger/10 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-danger/25 text-danger">
                            {b.code}
                          </span>
                        </div>
                        <p className="font-semibold text-soft">{b.message}</p>
                      </div>
                      {onNavigateTab && (
                        <button
                          onClick={() => {
                            setReadinessModalOpen(false);
                            onNavigateTab(b.fix_tab);
                          }}
                          className="shrink-0 px-3 py-1.5 rounded-xl font-bold bg-muted border border-border-strong hover:border-primary text-foreground transition shadow-sm"
                        >
                          Fix in {FIX_LABEL[b.fix_tab] ?? b.fix_tab}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {readinessReport.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-warning">
                  Optional Warnings ({readinessReport.warnings.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {readinessReport.warnings.map((w, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-2xl border border-warning/30 bg-warning/10 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-warning/25 text-warning">
                            {w.code}
                          </span>
                        </div>
                        <p className="font-semibold text-soft">{w.message}</p>
                      </div>
                      {onNavigateTab && (
                        <button
                          onClick={() => {
                            setReadinessModalOpen(false);
                            onNavigateTab(w.fix_tab);
                          }}
                          className="shrink-0 px-3 py-1.5 rounded-xl font-bold bg-muted border border-border-strong hover:border-primary text-foreground transition shadow-sm"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setReadinessModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-border bg-muted hover:bg-muted-strong transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basics */}
      <div className={cardCls}>
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <h3 className="font-black text-foreground">Basics</h3>
          <span className="text-xs text-muted-foreground">{isTeam ? "Team event" : "Open event"}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Tournament name</label>
            <input value={form.name} onChange={(e) => upd("name", e.target.value)} className={inputCls} placeholder="e.g. INVICTA 2026" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Venue</label>
            <input value={form.venue ?? ""} onChange={(e) => upd("venue", e.target.value)} className={inputCls} placeholder="Gymkhana Courts" />
          </div>
          <div>
            <label className={labelCls}>Start date</label>
            <input type="date" value={form.start_date ?? ""} onChange={(e) => upd("start_date", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End / finals date</label>
            <input type="date" value={form.end_date ?? ""} onChange={(e) => upd("end_date", e.target.value)} className={inputCls} />
          </div>
          {!isTeam && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Categories</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const active = form.categories?.includes(cat);
                  return (
                    <button key={cat} type="button"
                      onClick={() => upd("categories", active ? form.categories.filter((c) => c !== cat) : [...(form.categories ?? []), cat])}
                      className={`px-4 py-1.5 rounded-xl text-sm font-black border transition-all ${active ? "bg-primary text-primary-foreground border-primary" : "border-border-strong text-muted-foreground hover:border-primary"}`}>
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={labelCls}>Who can enter</label>
            <input value={form.eligibility ?? ""} onChange={(e) => upd("eligibility", e.target.value)} className={inputCls} placeholder="All IISc Members" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea value={form.description ?? ""} onChange={(e) => upd("description", e.target.value)} className={inputCls} rows={2} placeholder="Short blurb…" />
          </div>
        </div>
      </div>

      {/* Registration */}
      <div className={cardCls}>
        <h3 className="font-black text-foreground mb-4">How players sign up</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="font-bold text-soft text-sm flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-primary" /> Sign up in the app
            </span>
            <p className="text-xs text-muted-foreground">
              Signed-in players register and pick categories here; you approve them on the {isTeam ? "Teams" : "Players"} tab.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!form.require_app_registration}
            aria-label="Sign up in the app"
            onClick={() => upd("require_app_registration", !form.require_app_registration)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${form.require_app_registration ? "bg-primary" : "bg-muted-strong"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-foreground transition-transform ${form.require_app_registration ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!form.require_app_registration && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Or link an external form</label>
              <input type="url" value={form.form_url ?? ""} onChange={(e) => upd("form_url", e.target.value)} className={inputCls} placeholder="https://forms.office.com/…" />
            </div>
          )}
          <div>
            <label className={labelCls}>Sign-up status</label>
            <select value={form.form_status} onChange={(e) => upd("form_status", e.target.value)} className={inputCls}>
              <option value="open">Open</option>
              <option value="closing_soon">Closing soon</option>
              <option value="closed">Closed</option>
              <option value="disabled">Hidden</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Closes on</label>
            <input
              type="datetime-local"
              value={toLocalDatetimeStr(form.form_close_date)}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) upd("form_close_date", "");
                else upd("form_close_date", new Date(val).toISOString());
              }}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {isTeam && (
        <CollapsibleSection
          title="Team format"
          icon={<Users />}
          summary={`${rubbers.length} rubber${rubbers.length === 1 ? "" : "s"} per tie`}
          defaultOpen={rubbers.length === 0}
          focus={focusSection === "team"}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.format_family === 'TEAM' && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Rubbers in a tie</label>
              <div className="space-y-2 border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-3">Quickly add or remove rubbers to build the default order of play for a tie.</p>
                
                <div className="flex flex-wrap gap-4 mb-6">
                  {CATEGORIES.map(cat => (
                    <div key={cat} className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-muted-foreground mb-1">{cat}</span>
                      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border-strong/50">
                        <button 
                          onClick={() => removeLastOfCategory(cat)} 
                          disabled={!categoriesCount[cat]} 
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-muted-strong shadow-sm disabled:opacity-30 disabled:shadow-none transition-all hover:bg-faint text-soft font-bold"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-black text-soft">
                          {categoriesCount[cat] || 0}
                        </span>
                        <button 
                          onClick={() => addOfCategory(cat)} 
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-muted-strong shadow-sm transition-all hover:bg-faint text-soft font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {getRubbersList(form.tie_format_config).map((rubber: any, i: number) => (
                  <div 
                    key={i} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleDrop(e, i)}
                    className={`flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-border last:border-0 group transition-all cursor-move ${
                      draggedRubberIndex === i ? 'opacity-50 scale-[0.98]' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center pr-2 border-r border-border-strong cursor-move text-soft hover:text-primary transition-colors">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground w-4 text-center">#{i+1}</span>
                    <input 
                      className={`${inputCls} !w-24 !py-1`} 
                      placeholder="Label (e.g. MS1)" 
                      value={rubber.label || ''} 
                      onChange={(e) => {
                        const newConfig = [...getRubbersList(form.tie_format_config)];
                        newConfig[i].label = e.target.value;
                        updateRubbersList(newConfig);
                      }}
                    />
                    <select 
                      className={`${inputCls} !w-20 !py-1`}
                      value={rubber.category || 'MS'}
                      onChange={(e) => {
                        const newConfig = [...getRubbersList(form.tie_format_config)];
                        newConfig[i].category = e.target.value;
                        updateRubbersList(autoLabelRubbers(newConfig));
                      }}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Pts:</span>
                      <input 
                        type="number" 
                        className={`${inputCls} !w-16 !py-1`} 
                        value={rubber.points ?? 1} 
                        onChange={(e) => {
                          const newConfig = [...getRubbersList(form.tie_format_config)];
                          newConfig[i].points = parseInt(e.target.value) || 0;
                          updateRubbersList(newConfig);
                        }}
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const newConfig = [...getRubbersList(form.tie_format_config)];
                        newConfig.splice(i, 1);
                        updateRubbersList(autoLabelRubbers(newConfig));
                      }}
                      className="p-1.5 text-danger hover:bg-danger/10 rounded"
                      title="Remove Rubber"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {form.format_family === 'TEAM' && (() => {
            const currentRubbers = getRubbersList(form.tie_format_config);
            const rulesObj = typeof form.tie_format_config === 'object' && !Array.isArray(form.tie_format_config) ? form.tie_format_config : {};
            const maxMale = rulesObj.max_rubbers_per_male ?? form.max_rubbers_per_player ?? 2;
            const maxFemale = rulesObj.max_rubbers_per_female ?? form.max_rubbers_per_player ?? 2;
            const allowSameDiscipline = rulesObj.allow_same_discipline_repeat ?? false;
            const allowSameEventDecider = rulesObj.allow_same_event_repeat_in_decider ?? false;

            const rosterReq = calculateMinRosterRequirements(currentRubbers, {
              max_rubbers_per_male: maxMale,
              max_rubbers_per_female: maxFemale,
              allow_same_discipline_repeat: allowSameDiscipline,
              ignore_gender_rules: form.ignore_gender_rules
            });

            const updateRule = (key: string, value: any) => {
              const currentObj = typeof form.tie_format_config === 'object' && !Array.isArray(form.tie_format_config)
                ? { ...form.tie_format_config }
                : { rubbers: currentRubbers };
              currentObj[key] = value;
              upd("tie_format_config", currentObj);
            };

            return (
              <div className="sm:col-span-2 border border-border rounded-2xl p-5 bg-card/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Player Repetition &amp; Lineup Restrictions
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure different caps for male and female players and prevent same-discipline conflicts.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <span>Dynamic Roster Minimum:</span>
                    <span className="font-black text-sm">{rosterReq.minTotalPlayers} players</span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      ({rosterReq.minMalePlayers}♂, {rosterReq.minFemalePlayers}♀)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-bold text-soft block mb-1">
                      Max Rubbers per Male Player
                    </label>
                    <select
                      className={inputCls}
                      value={maxMale}
                      onChange={(e) => updateRule('max_rubbers_per_male', parseInt(e.target.value) || 2)}
                    >
                      <option value={1}>1 rubber only (No repeats)</option>
                      <option value={2}>At most 2 rubbers (Standard)</option>
                      <option value={3}>At most 3 rubbers</option>
                      <option value={4}>Unlimited / 4 rubbers</option>
                    </select>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      Requires at least {rosterReq.minMalePlayers} male players for {rosterReq.totalMaleSlots} male slot{rosterReq.totalMaleSlots !== 1 ? 's' : ''}.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-soft block mb-1">
                      Max Rubbers per Female Player
                    </label>
                    <select
                      className={inputCls}
                      value={maxFemale}
                      onChange={(e) => updateRule('max_rubbers_per_female', parseInt(e.target.value) || 2)}
                    >
                      <option value={1}>1 rubber only (No repeats)</option>
                      <option value={2}>At most 2 rubbers (Standard)</option>
                      <option value={3}>At most 3 rubbers (Flexible)</option>
                      <option value={4}>Unlimited / 4 rubbers</option>
                    </select>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      Requires at least {rosterReq.minFemalePlayers} female players for {rosterReq.totalFemaleSlots} female slot{rosterReq.totalFemaleSlots !== 1 ? 's' : ''}.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-soft block mb-1">
                      Minimum Squad Size Required
                    </label>
                    <input
                      type="number"
                      min={rosterReq.minTotalPlayers}
                      className={inputCls}
                      value={form.team_roster_min || rosterReq.minTotalPlayers}
                      onChange={(e) => upd("team_roster_min", parseInt(e.target.value) || rosterReq.minTotalPlayers)}
                    />
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      Math minimum is {rosterReq.minTotalPlayers}. You can set a higher team threshold.
                    </span>
                  </div>
                </div>

                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!allowSameDiscipline}
                      onChange={(e) => updateRule('allow_same_discipline_repeat', !e.target.checked)}
                      className="w-4 h-4 accent-primary rounded mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-soft block">
                        Disallow Same-Discipline Repeats
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        A player who played MS1 cannot play MS2 (or WS1/WS2).
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowSameEventDecider}
                      onChange={(e) => updateRule('allow_same_event_repeat_in_decider', e.target.checked)}
                      className="w-4 h-4 accent-primary rounded mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-soft block">
                        Allow Same Event Player in Decider
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        If tie has a decider (e.g. XD2), allow players who already played regular XD1.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            );
          })()}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ignore_gender_rules ?? false}
                onChange={(e) => upd("ignore_gender_rules", e.target.checked)}
                className="w-5 h-5 accent-primary rounded border-border-strong mt-0.5"
              />
              <div>
                <span className="text-sm font-bold text-soft block">Ignore gender rules</span>
                <span className="text-xs text-muted-foreground block">Allow any player to play any rubber (e.g. women in MS).</span>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.play_dead_rubbers ?? true}
                onChange={(e) => upd("play_dead_rubbers", e.target.checked)}
                className="w-5 h-5 accent-primary rounded border-border-strong mt-0.5"
              />
              <div>
                <span className="text-sm font-bold text-soft block">Play dead rubbers</span>
                <span className="text-xs text-muted-foreground block">Play all remaining rubbers even if the tie is already won.</span>
              </div>
            </label>
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        bare
        title="Scoring rules"
        icon={<Gauge />}
        summary="Points, games and caps per round"
        focus={focusSection === "rules"}
      >
        <ScoringRulesPanel tournament={tournament as any} />
      </CollapsibleSection>

      <CollapsibleSection
        bare
        title="Officials"
        icon={<ShieldCheck />}
        summary="Umpires and referees"
        focus={focusSection === "officials"}
      >
        <TournamentOfficialsPanel tournament={tournament} />
      </CollapsibleSection>

      <CollapsibleSection
        title="More settings"
        icon={<Settings2 />}
        summary="Visibility, ranking, rest times, court blackouts, reminders"
        focus={focusSection === "more"}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Listing</label>
              <select value={form.tournament_type} onChange={(e) => upd("tournament_type", e.target.value)} className={inputCls}>
                <option value="open">Open (public)</option>
                <option value="invitational">Invitational</option>
                <option value="internal">Internal only</option>
              </select>
            </div>
            <div className="space-y-2.5 sm:pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={!!form.show_participants} onChange={(e) => upd("show_participants", e.target.checked)} className="w-5 h-5 accent-primary rounded border-border-strong" />
                <span className="text-sm font-bold text-soft">Show the player list publicly</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={!!form.show_brackets} onChange={(e) => upd("show_brackets", e.target.checked)} className="w-5 h-5 accent-primary rounded border-border-strong" />
                <span className="text-sm font-bold text-soft">Show the draw publicly</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.counts_for_elo ?? true} onChange={(e) => upd("counts_for_elo", e.target.checked)} className="w-5 h-5 accent-primary rounded border-border-strong mt-0.5" />
              <div>
                <span className="text-sm font-bold text-soft block">Counts for ELO</span>
                <span className="text-xs text-muted-foreground block">Results update players' ratings. Turn off for casual events.</span>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.auto_reminders_enabled !== false} onChange={(e) => upd("auto_reminders_enabled", e.target.checked)} className="w-5 h-5 accent-primary rounded border-border-strong mt-0.5" />
              <div>
                <span className="text-sm font-bold text-soft flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-warning" /> Match reminders</span>
                <span className="text-xs text-muted-foreground block">Push and email players and umpires 30 minutes before each match.</span>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="flex items-center gap-2 text-sm font-black text-foreground mb-3">
              <Clock className="w-4 h-4 text-primary" /> Scheduling
            </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Minimum Rest Between Matches (Minutes)</label>
            <input
              type="number"
              min={0}
              max={180}
              value={form.min_rest_minutes ?? 15}
              onChange={(e) => upd("min_rest_minutes", parseInt(e.target.value) || 0)}
              className={inputCls}
              placeholder="15"
            />
            <span className="text-[10px] text-muted-foreground mt-1 block">
              Default is 15 minutes. Player rest gaps below this will flag conflicts.
            </span>
          </div>

          <div>
            <label className={labelCls}>Estimated Match Duration (Minutes)</label>
            <input
              type="number"
              min={10}
              max={180}
              value={form.estimated_match_minutes ?? 30}
              onChange={(e) => upd("estimated_match_minutes", parseInt(e.target.value) || 30)}
              className={inputCls}
              placeholder="30"
            />
            <span className="text-[10px] text-muted-foreground mt-1 block">
              Used to project match completion and detect overlapping court allocations.
            </span>
          </div>
        </div>

        {/* Unavailable Court Periods / Blackout times */}
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-soft">
                Unavailable Court Periods & Blackouts
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Block specific courts for maintenance, coaching, or ceremonies. Matches scheduled in these intervals will be blocked.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const current = Array.isArray(form.unavailable_court_periods) ? [...form.unavailable_court_periods] : [];
                const now = new Date();
                const startStr = now.toISOString();
                const endStr = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
                current.push({
                  id: crypto.randomUUID(),
                  court: "1",
                  start: startStr,
                  end: endStr,
                  reason: "Reserved / Maintenance",
                });
                upd("unavailable_court_periods", current);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition inline-flex items-center gap-1"
            >
              + Add Blackout
            </button>
          </div>

          {(!form.unavailable_court_periods || form.unavailable_court_periods.length === 0) ? (
            <p className="text-xs text-muted-foreground py-2 italic">No court blackout periods configured.</p>
          ) : (
            <div className="space-y-3">
              {form.unavailable_court_periods.map((period, idx) => (
                <div key={period.id || idx} className="p-3 rounded-xl border border-border bg-card/50 flex flex-wrap items-center gap-2">
                  <div className="w-20">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Court</label>
                    <input
                      type="text"
                      value={period.court}
                      onChange={(e) => {
                        const current = [...(form.unavailable_court_periods || [])];
                        current[idx] = { ...current[idx], court: e.target.value };
                        upd("unavailable_court_periods", current);
                      }}
                      placeholder="e.g. 1"
                      className={`${inputCls} !py-1 text-xs`}
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Start Time</label>
                    <input
                      type="datetime-local"
                      value={toLocalDatetimeStr(period.start)}
                      onChange={(e) => {
                        const current = [...(form.unavailable_court_periods || [])];
                        current[idx] = { ...current[idx], start: e.target.value ? new Date(e.target.value).toISOString() : "" };
                        upd("unavailable_court_periods", current);
                      }}
                      className={`${inputCls} !py-1 text-xs`}
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">End Time</label>
                    <input
                      type="datetime-local"
                      value={toLocalDatetimeStr(period.end)}
                      onChange={(e) => {
                        const current = [...(form.unavailable_court_periods || [])];
                        current[idx] = { ...current[idx], end: e.target.value ? new Date(e.target.value).toISOString() : "" };
                        upd("unavailable_court_periods", current);
                      }}
                      className={`${inputCls} !py-1 text-xs`}
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Reason</label>
                    <input
                      type="text"
                      value={period.reason ?? ""}
                      onChange={(e) => {
                        const current = [...(form.unavailable_court_periods || [])];
                        current[idx] = { ...current[idx], reason: e.target.value };
                        upd("unavailable_court_periods", current);
                      }}
                      placeholder="e.g. Coaching"
                      className={`${inputCls} !py-1 text-xs`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const current = [...(form.unavailable_court_periods || [])];
                      current.splice(idx, 1);
                      upd("unavailable_court_periods", current);
                    }}
                    className="p-1.5 text-danger hover:bg-danger/10 rounded mt-4"
                    title="Remove period"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Footer: trash + autosave state */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <button
          onClick={trashTournament}
          disabled={saving || transitioning}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-danger hover:bg-danger/10 disabled:opacity-50 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Move to trash
        </button>
        <div className="sticky bottom-24 lg:bottom-4 z-20 ml-auto">
          {saving ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-xs font-bold text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
            </span>
          ) : saveError ? (
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-danger/10 border border-danger/30 text-xs font-bold text-danger">
              <AlertTriangle className="w-3.5 h-3.5" /> {saveError}
              <button onClick={() => save(false)} className="underline">Retry</button>
            </span>
          ) : isDirty ? (
            <button onClick={() => save(false)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-lg">
              <Save className="w-3.5 h-3.5" /> Save now
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-muted-foreground">
              <Check className="w-3.5 h-3.5 text-success" /> All changes saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
