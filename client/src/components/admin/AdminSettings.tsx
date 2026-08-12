// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Save, Loader2, Settings, Zap, WrenchIcon, Bell, AlertTriangle, Power, Smartphone, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { InfoModal } from "@/components/InfoModal";

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";
const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
const labelCls = "block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5";

interface ClubSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  matchAnnouncementPush: boolean;
  challengeExpiryHours: number;
  confirmationNudgeHours: number;
  maxMatchesPerDay: number;
  showTournamentStandings: boolean;
  showPlayerDirectory: boolean;
}

const DEFAULTS: ClubSettings = {
  maintenanceMode: false,
  maintenanceMessage: "Site is under maintenance. Please check back shortly.",
  matchAnnouncementPush: true,
  challengeExpiryHours: 48,
  confirmationNudgeHours: 12,
  maxMatchesPerDay: 10,
  showTournamentStandings: false,
  showPlayerDirectory: false,
};

export function AdminSettings() {
  const { session } = useAuth();
  const { confirm } = useConfirm();
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

  const [savingUpdate, setSavingUpdate] = useState(false);
  const forceUpdatePrompt = async () => {
    if (!(await confirm({
      title: 'Force App Update',
      description: 'Are you sure you want to send a push notification to ALL users and force the update popup?',
      confirmVariant: 'danger',
      confirmLabel: 'Force Update'
    }))) return;
    setSavingUpdate(true);
    try {
      // Import fetchSiteData dynamically to avoid circular dependencies if any, or just fetch directly
      const { fetchSiteData } = await import("@/lib/siteData");
      const latest = await fetchSiteData<any>("app_version", "app-version.json");
      const currentVersion = latest?.versionCode || 1;
      const nextVersion = currentVersion + 1;
      
      const newAppVersion = {
        ...(latest || {}),
        versionCode: nextVersion,
        versionName: `Update (Forced)`,
        changelog: "A new mandatory update is available. Please update the app to continue."
      };
      
      await supabase.from("site_data").upsert({ key: "app_version", value: newAppVersion, updated_at: new Date().toISOString() }, { onConflict: "key" });
      
      await supabase.functions.invoke("send-announcement", {
        body: { title: "Update Available", body: "A new version of IISc Badminton Club is available! Please open the app to update." },
      });
      
      await supabase.from("admin_logs").insert({ admin_email: session?.user?.email || "admin", action: `Forced app update prompt (v${nextVersion})`, created_at: new Date().toISOString() });
      
      toast.success("Update notification sent and popup forced!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to force update");
    } finally {
      setSavingUpdate(false);
    }
  };

  const [exporting, setExporting] = useState<string | null>(null);

  const exportData = async (tableName: string, label: string) => {
    try {
      const formatSelect = document.getElementById(`fmt-${tableName}`) as HTMLSelectElement;
      const format = formatSelect ? formatSelect.value : "csv";

      setExporting(tableName);
      toast.loading(`Fetching ${label.toLowerCase()}...`, { id: "export-data" });
      const { data, error } = await supabase.from(tableName).select("*");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(`No ${label.toLowerCase()} found`);

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `iisbc_${tableName}_backup_${timestamp}`;

      if (format === 'json') {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        triggerDownload(blob, `${filename}.json`);
      } else if (format === 'csv') {
        const headers = Object.keys(data[0]);
        const csvLines = [headers.join(",")];
        for (const row of data) {
          const line = headers.map(header => {
            let val = row[header];
            if (val === null || val === undefined) val = "";
            else if (typeof val === "object") val = JSON.stringify(val);
            else val = String(val);
            val = val.replace(/"/g, '""');
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
              val = `"${val}"`;
            }
            return val;
          });
          csvLines.push(line.join(","));
        }
        const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
        triggerDownload(blob, `${filename}.csv`);
      } else if (format === 'xlsx') {
        // dynamic import xlsx
        const XLSX = await import("xlsx");
        const sheetData = data.map(row => {
          const newRow: any = {};
          for (const key in row) {
            newRow[key] = typeof row[key] === 'object' && row[key] !== null ? JSON.stringify(row[key]) : row[key];
          }
          return newRow;
        });
        const worksheet = XLSX.utils.json_to_sheet(sheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, label);
        XLSX.writeFile(workbook, `${filename}.xlsx`);
      } else if (format === 'pdf') {
        // Native PDF print via popup
        const headers = Object.keys(data[0]);
        let html = `<html><head><title>${label} Backup - ${timestamp}</title><style>
          body { font-family: sans-serif; margin: 20px; font-size: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
          th { background-color: #f2f2f2; }
          @media print { @page { size: landscape; } }
        </style></head><body>`;
        html += `<h2>${label} Backup - ${timestamp}</h2>`;
        html += `<table><thead><tr>`;
        headers.forEach(h => html += `<th>${h}</th>`);
        html += `</tr></thead><tbody>`;
        data.forEach(row => {
          html += `<tr>`;
          headers.forEach(h => {
             let val = row[h];
             if (val === null || val === undefined) val = "";
             else if (typeof val === "object") val = JSON.stringify(val);
             else val = String(val);
             html += `<td>${val.substring(0, 150)}</td>`;
          });
          html += `</tr>`;
        });
        html += `</tbody></table></body></html>`;

        const printWin = window.open('', '', 'width=800,height=600');
        if (printWin) {
          printWin.document.open();
          printWin.document.write(html);
          printWin.document.close();
          setTimeout(() => {
            printWin.print();
            printWin.close();
          }, 250);
        } else {
           throw new Error("Popup blocked! Please allow popups for PDF printing.");
        }
      }

      await supabase.from("admin_logs").insert({ admin_email: session?.user?.email || "admin", action: `Exported ${tableName} to ${format.toUpperCase()}`, created_at: new Date().toISOString() });
      toast.success(`${label} exported as ${format.toUpperCase()}!`, { id: "export-data" });
    } catch (err: any) {
      toast.error(err.message || `Failed to export ${label.toLowerCase()}`, { id: "export-data" });
    } finally {
      setExporting(null);
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

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



  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Maintenance Mode */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Power className="w-5 h-5 text-rose-500" />
          <h3 className="font-black text-slate-800 dark:text-foreground">Maintenance Mode</h3>
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
            <p className="font-bold text-slate-800 dark:text-foreground text-sm">Enable Maintenance Mode</p>
            <p className="text-xs text-muted-foreground mt-0.5">Shows a maintenance banner and optionally blocks match logging</p>
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


      {/* Feature Toggles */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="font-black text-slate-800 dark:text-foreground">Feature Toggles</h3>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-slate-800 dark:text-foreground text-sm">Show Tournament Standings</p>
              <p className="text-xs text-muted-foreground mt-0.5">Allow players to see the /standings page. (Admins can always see it)</p>
            </div>
            <button
              onClick={() => update("showTournamentStandings", !settings.showTournamentStandings)}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.showTournamentStandings ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.showTournamentStandings ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-slate-800 dark:text-foreground text-sm">Show Player Directory</p>
              <p className="text-xs text-muted-foreground mt-0.5">Show the searchable player directory in Pulse to all users. (Admins can always see it)</p>
            </div>
            <button
              onClick={() => update("showPlayerDirectory", !settings.showPlayerDirectory)}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.showPlayerDirectory ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.showPlayerDirectory ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-blue-500" />
          <h3 className="font-black text-slate-800 dark:text-foreground">Automation & Notifications</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-slate-800 dark:text-foreground text-sm">Push on Announcements</p>
              <p className="text-xs text-muted-foreground mt-0.5">Send a push notification when a new announcement is published</p>
            </div>
            <button
              onClick={() => update("matchAnnouncementPush", !settings.matchAnnouncementPush)}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.matchAnnouncementPush ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
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
              <p className="text-[10px] text-muted-foreground mt-1">Auto-expire unanswered challenges after N hours</p>
            </div>
            <div>
              <label className={labelCls}>Confirmation Nudge (hours)</label>
              <input
                type="number" min={6} max={72} step={6}
                value={settings.confirmationNudgeHours}
                onChange={(e) => update("confirmationNudgeHours", Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Remind opponent to confirm match after N hours</p>
            </div>
            <div>
              <label className={labelCls}>Max Matches per Day per Player</label>
              <input
                type="number" min={1} max={20} step={1}
                value={settings.maxMatchesPerDay}
                onChange={(e) => update("maxMatchesPerDay", Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Rate-limit: prevents ELO farming</p>
            </div>
          </div>
        </div>
      </div>

      {/* App Updates */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-5 h-5 text-indigo-500" />
          <h3 className="font-black text-slate-800 dark:text-foreground">Force App Update Prompt</h3>
          <InfoModal
            title="APP UPDATE PROMPT"
            items={[
              { badge: "FORCE", title: "Trigger Popup", desc: "This increments the internal app version code and sends a push notification. The next time users open the app, they will see a mandatory update popup." }
            ]}
          />
        </div>
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>
            <p className="font-bold text-slate-800 dark:text-foreground text-sm">Send Update Notification</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">Sends a push notification to all users and forces the update popup on next launch.</p>
          </div>
          <button
            onClick={forceUpdatePrompt}
            disabled={savingUpdate}
            className="shrink-0 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-2"
          >
            {savingUpdate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {savingUpdate ? "Sending..." : "Send Now"}
          </button>
        </div>
      </div>

      {/* Data Export */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-emerald-500" />
          <h3 className="font-black text-slate-800 dark:text-foreground">Data Export</h3>
          <InfoModal
            title="DATA EXPORT"
            items={[
              { badge: "BACKUP", title: "Instant Download", desc: "Instantly download files containing all records directly to your computer. Supports CSV, Excel, JSON, and PDF." }
            ]}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Players */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-slate-800 dark:text-foreground text-sm">Players</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-sm">Names, ELOs, roles, etc.</p>
            </div>
            <div className="flex items-center gap-2">
              <select id="fmt-players" className="text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none">
                 <option value="csv">CSV</option>
                 <option value="xlsx">Excel</option>
                 <option value="json">JSON</option>
                 <option value="pdf">PDF</option>
              </select>
              <button
                onClick={() => exportData("players", "Players")}
                disabled={exporting !== null}
                className="shrink-0 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {exporting === "players" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export
              </button>
            </div>
          </div>

          {/* Matches */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-slate-800 dark:text-foreground text-sm">Matches</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-sm">Scores, timestamps, umpires.</p>
            </div>
            <div className="flex items-center gap-2">
              <select id="fmt-tournament_matches" className="text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none">
                 <option value="csv">CSV</option>
                 <option value="xlsx">Excel</option>
                 <option value="json">JSON</option>
                 <option value="pdf">PDF</option>
              </select>
              <button
                onClick={() => exportData("tournament_matches", "Matches")}
                disabled={exporting !== null}
                className="shrink-0 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {exporting === "tournament_matches" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export
              </button>
            </div>
          </div>

          {/* Tournaments */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-slate-800 dark:text-foreground text-sm">Tournaments</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-sm">All tournament listings.</p>
            </div>
            <div className="flex items-center gap-2">
              <select id="fmt-tournaments" className="text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none">
                 <option value="csv">CSV</option>
                 <option value="xlsx">Excel</option>
                 <option value="json">JSON</option>
                 <option value="pdf">PDF</option>
              </select>
              <button
                onClick={() => exportData("tournaments", "Tournaments")}
                disabled={exporting !== null}
                className="shrink-0 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {exporting === "tournaments" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export
              </button>
            </div>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-slate-800 dark:text-foreground text-sm">Doubles Teams</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-sm">Registered teams & stats.</p>
            </div>
            <div className="flex items-center gap-2">
              <select id="fmt-doubles_teams" className="text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none">
                 <option value="csv">CSV</option>
                 <option value="xlsx">Excel</option>
                 <option value="json">JSON</option>
                 <option value="pdf">PDF</option>
              </select>
              <button
                onClick={() => exportData("doubles_teams", "Teams")}
                disabled={exporting !== null}
                className="shrink-0 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {exporting === "doubles_teams" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export
              </button>
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
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
