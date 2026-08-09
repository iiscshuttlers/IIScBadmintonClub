// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Save, Loader2, Trophy, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_TOURNAMENT_CONFIG,
  tournamentDatesDisplay,
  type TournamentConfig,
  type FormStatus,
} from "@/lib/tournaments";

const cardCls =
  "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";
const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
const labelCls =
  "block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5";

const FORM_STATUSES: { value: FormStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closing_soon", label: "Closing soon" },
  { value: "closed", label: "Closed" },
  { value: "disabled", label: "Disabled (hide form)" },
];

export function TournamentEditor() {
  const { session } = useAuth();
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_TOURNAMENT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "tournament_config")
      .maybeSingle();
    if (data?.value)
      setConfig({ ...DEFAULT_TOURNAMENT_CONFIG, ...(data.value as Partial<TournamentConfig>) });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await supabase.from("site_data").upsert(
        { key: "tournament_config", value: config, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      await supabase.from("admin_logs").insert({
        admin_email: session?.user?.email || "admin",
        action: `Updated tournament config (${config.name})`,
        created_at: new Date().toISOString(),
      });
      toast.success("Tournament details saved");
      setDirty(false);
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Visibility */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-black text-slate-800 dark:text-foreground">Tournament Section</h3>
        </div>
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {config.enabled ? (
              <Eye className="w-4 h-4 text-primary" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
            <div>
              <p className="font-bold text-slate-800 dark:text-foreground text-sm">
                Show on Events page
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adds the "{config.name}" tab to the Events page
              </p>
            </div>
          </div>
          <button
            onClick={() => update("enabled", !config.enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${config.enabled ? "left-6" : "left-0.5"}`}
            />
          </button>
        </div>
      </div>

      {/* Basic details */}
      <div className={cardCls}>
        <h3 className="font-black text-slate-800 dark:text-foreground mb-4">Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Tournament Name (short)</label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputCls}
              placeholder="e.g. INVICTA 2026 or Upcoming Tournament"
            />
          </div>
          <div>
            <label className={labelCls}>Venue</label>
            <input
              type="text"
              value={config.venue}
              onChange={(e) => update("venue", e.target.value)}
              className={inputCls}
              placeholder="Gymkhana Courts"
            />
          </div>
          <div>
            <label className={labelCls}>Categories</label>
            <input
              type="text"
              value={config.categories}
              onChange={(e) => update("categories", e.target.value)}
              className={inputCls}
              placeholder="MS · WS · MD · WD · XD  or  Team Event"
            />
          </div>
          <div>
            <label className={labelCls}>Eligibility</label>
            <input
              type="text"
              value={config.eligibility}
              onChange={(e) => update("eligibility", e.target.value)}
              className={inputCls}
              placeholder="All IISc Members"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea
              value={config.description}
              onChange={(e) => update("description", e.target.value)}
              className={inputCls}
              rows={2}
              placeholder="Short blurb shown with the registration call-to-action"
            />
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className={cardCls}>
        <h3 className="font-black text-slate-800 dark:text-foreground mb-1">Dates</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Set a start &amp; end date once confirmed. Leave both blank to show the label
          below (e.g. "Not yet announced" or "Postponed"). Dates also appear on the
          Events calendar.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Start Date</label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) => update("startDate", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>End / Finals Date</label>
            <input
              type="date"
              value={config.endDate}
              onChange={(e) => update("endDate", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Label (when no dates)</label>
            <input
              type="text"
              value={config.datesLabel}
              onChange={(e) => update("datesLabel", e.target.value)}
              className={inputCls}
              placeholder="Not yet announced / Postponed"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Preview: <span className="font-bold text-muted-foreground dark:text-slate-300">{tournamentDatesDisplay(config)}</span>
        </p>
      </div>

      {/* Registration form */}
      <div className={cardCls}>
        <h3 className="font-black text-slate-800 dark:text-foreground mb-4">Registration Form</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Form Link (Microsoft Form / Google Form URL)</label>
            <input
              type="url"
              value={config.formUrl}
              onChange={(e) => update("formUrl", e.target.value)}
              className={inputCls}
              placeholder="https://forms.cloud.microsoft/r/..."
            />
          </div>
          <div>
            <label className={labelCls}>Form Status</label>
            <select
              value={config.formStatus}
              onChange={(e) => update("formStatus", e.target.value as FormStatus)}
              className={inputCls}
            >
              {FORM_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Form Closes On (calendar)</label>
            <input
              type="date"
              value={config.formCloseDate}
              onChange={(e) => update("formCloseDate", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          "Disabled" hides the registration box entirely. "Closed" shows a greyed-out
          button.
        </p>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold transition shadow-lg shadow-primary/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Tournament Details"}
        </button>
      </div>
    </div>
  );
}
