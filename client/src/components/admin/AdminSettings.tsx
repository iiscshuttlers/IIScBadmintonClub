import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Save, Loader2, Settings, Zap, WrenchIcon, Bell, AlertTriangle, Power } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { InfoModal } from "@/components/InfoModal";

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";
const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition";
const labelCls = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";

interface ClubSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  eloKFactorCalibration: number;
  eloKFactorStable: number;
  eloGlobalMultiplier: number;
  matchAnnouncementPush: boolean;
  challengeExpiryHours: number;
  confirmationNudgeHours: number;
  maxMatchesPerDay: number;
}

const DEFAULTS: ClubSettings = {
  maintenanceMode: false,
  maintenanceMessage: "Site is under maintenance. Please check back shortly.",
  eloKFactorCalibration: 32,
  eloKFactorStable: 16,
  eloGlobalMultiplier: 0.33,
  matchAnnouncementPush: true,
  challengeExpiryHours: 48,
  confirmationNudgeHours: 12,
  maxMatchesPerDay: 10,
};

export function AdminSettings() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<ClubSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("site_data").select("value").eq("key", "club_settings").maybeSingle();
    if (data?.value) setSettings({ ...DEFAULTS, ...(data.value as Partial<ClubSettings>) });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = <K extends keyof ClubSettings>(key: K, value: ClubSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await supabase.from("site_data").upsert({ key: "club_settings", value: settings, updated_at: new Date().toISOString() }, { onConflict: "key" });
      // Log admin action
      await supabase.from("admin_logs").insert({ admin_email: session?.user?.email || "admin", action: "Updated club settings", created_at: new Date().toISOString() });
      toast.success("Settings saved");
      setDirty(false);
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };



  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="space-y-6">
      {/* Maintenance Mode */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Power className="w-5 h-5 text-rose-500" />
          <h3 className="font-black text-slate-800 dark:text-white">Maintenance Mode</h3>
          <InfoModal
            title="MAINTENANCE MODE"
            items={[
              { badge: "VISUAL", title: "Site-wide Banner", desc: "Displays a red banner across all pages notifying users of maintenance." },
              { badge: "RESTRICT", title: "Blocks Match Logging", desc: "Prevents players from logging new matches while active." }
            ]}
          />
        </div>
        <div className="flex items-center justify-between mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>
            <p className="font-bold text-slate-800 dark:text-white text-sm">Enable Maintenance Mode</p>
            <p className="text-xs text-slate-500 mt-0.5">Shows a maintenance banner and optionally blocks match logging</p>
          </div>
          <button
            onClick={() => update("maintenanceMode", !settings.maintenanceMode)}
            className={`relative w-12 h-6 rounded-full transition-colors ${settings.maintenanceMode ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-600"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.maintenanceMode ? "left-6" : "left-0.5"}`} />
          </button>
        </div>
        {settings.maintenanceMode && (
          <div>
            <label className={labelCls}>Maintenance Message</label>
            <textarea
              value={settings.maintenanceMessage}
              onChange={(e) => update("maintenanceMessage", e.target.value)}
              className={inputCls}
              rows={2}
              placeholder="Message to show users during maintenance..."
            />
          </div>
        )}
        {settings.maintenanceMode && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Maintenance mode is currently ON. All users will see a maintenance banner.
          </div>
        )}
      </div>

      {/* ELO Configuration */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-emerald-500" />
          <h3 className="font-black text-slate-800 dark:text-white">ELO Rating Configuration</h3>
          <InfoModal
            title="ELO CONFIGURATION"
            items={[
              { badge: "K-CALIB", title: "Calibration Phase", desc: "Used for a player's first 10 matches. Causes massive rating swings to quickly find their true skill level." },
              { badge: "K-STABLE", title: "Stable Phase", desc: "Used after 10 matches. Standard rating adjustments for consistent, slower movement." },
              { badge: "MULTIPLIER", title: "Global Multiplier", desc: "Scales down all point exchanges globally to prevent hyper-inflation of ratings over time." }
            ]}
          />
          <span className="text-xs text-slate-400 font-medium ml-auto">(applied on next recalculation)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>K-Factor (Calibration, first 10 matches)</label>
            <input
              type="number"
              min={8} max={64} step={4}
              value={settings.eloKFactorCalibration}
              onChange={(e) => update("eloKFactorCalibration", Number(e.target.value))}
              className={inputCls}
            />
            <p className="text-[10px] text-slate-400 mt-1">Default: 32 (higher = faster rating movement)</p>
          </div>
          <div>
            <label className={labelCls}>K-Factor (Stable, 10+ matches)</label>
            <input
              type="number"
              min={4} max={32} step={4}
              value={settings.eloKFactorStable}
              onChange={(e) => update("eloKFactorStable", Number(e.target.value))}
              className={inputCls}
            />
            <p className="text-[10px] text-slate-400 mt-1">Default: 16</p>
          </div>
          <div>
            <label className={labelCls}>Global ELO Multiplier (0–1)</label>
            <input
              type="number"
              min={0.1} max={1} step={0.01}
              value={settings.eloGlobalMultiplier}
              onChange={(e) => update("eloGlobalMultiplier", Number(e.target.value))}
              className={inputCls}
            />
            <p className="text-[10px] text-slate-400 mt-1">Default: 0.33 (global ELO moves at 1/3 speed)</p>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-blue-500" />
          <h3 className="font-black text-slate-800 dark:text-white">Automation & Notifications</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-slate-800 dark:text-white text-sm">Push on Announcements</p>
              <p className="text-xs text-slate-500 mt-0.5">Send a push notification when a new announcement is published</p>
            </div>
            <button
              onClick={() => update("matchAnnouncementPush", !settings.matchAnnouncementPush)}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.matchAnnouncementPush ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.matchAnnouncementPush ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Challenge Expiry (hours)</label>
              <input
                type="number" min={12} max={168} step={12}
                value={settings.challengeExpiryHours}
                onChange={(e) => update("challengeExpiryHours", Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 mt-1">Auto-expire unanswered challenges after N hours</p>
            </div>
            <div>
              <label className={labelCls}>Confirmation Nudge (hours)</label>
              <input
                type="number" min={6} max={72} step={6}
                value={settings.confirmationNudgeHours}
                onChange={(e) => update("confirmationNudgeHours", Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 mt-1">Remind opponent to confirm match after N hours</p>
            </div>
            <div>
              <label className={labelCls}>Max Matches per Day per Player</label>
              <input
                type="number" min={1} max={20} step={1}
                value={settings.maxMatchesPerDay}
                onChange={(e) => update("maxMatchesPerDay", Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 mt-1">Rate-limit: prevents ELO farming</p>
            </div>
          </div>
        </div>
      </div>



      {/* Save */}
      {dirty && (
        <div className="sticky bottom-6 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
