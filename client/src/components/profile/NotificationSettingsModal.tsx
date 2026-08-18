import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Bell, BellRing, BellOff, Loader2, Trophy, Megaphone, ShieldAlert, Swords } from "lucide-react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { enableWebPush } from "@/hooks/usePushNotifications";

interface NotificationSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// localStorage keys for category toggles (opt-out: absent or "true" = enabled)
const LS_KEYS = {
  match_results:        "iisc_notify_match_results",
  tournament_started:   "iisc_notify_tournament_started",
  announcements:        "iisc_notify_announcements",
  admin_push:           "iisc_notify_admin_push",
} as const;

type LocalPrefKey = keyof typeof LS_KEYS;

function getLocalPref(key: LocalPrefKey): boolean {
  return localStorage.getItem(LS_KEYS[key]) !== "false";
}

function setLocalPref(key: LocalPrefKey, value: boolean) {
  localStorage.setItem(LS_KEYS[key], value ? "true" : "false");
}

export function NotificationSettingsModal({ open, onOpenChange }: NotificationSettingsModalProps) {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);

  // DB-backed sound preferences
  const [prefs, setPrefs] = useState({
    pref_notify_smash:   profile?.pref_notify_smash   ?? true,
    pref_notify_point:   profile?.pref_notify_point   ?? true,
    pref_notify_serve:   profile?.pref_notify_serve   ?? true,
    pref_notify_whistle: profile?.pref_notify_whistle ?? true,
    pref_notify_victory: profile?.pref_notify_victory ?? true,
  });

  // localStorage-backed category preferences (instant, no DB needed)
  const [localPrefs, setLocalPrefs] = useState<Record<LocalPrefKey, boolean>>({
    match_results:      true,
    tournament_started: true,
    announcements:      true,
    admin_push:         true,
  });

  useEffect(() => {
    if (open) {
      setLocalPrefs({
        match_results:      getLocalPref("match_results"),
        tournament_started: getLocalPref("tournament_started"),
        announcements:      getLocalPref("announcements"),
        admin_push:         getLocalPref("admin_push"),
      });
      checkPermissions();
    }
  }, [open]);

  // Web and PWA report permission through the Notification API, not the
  // Capacitor plugin. Checking only the native path left browser users looking
  // at a permanently "off" panel with a button that refused to do anything.
  const checkPermissions = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { receive } = await PushNotifications.checkPermissions();
        setPushGranted(receive === "granted");
      } else if ("Notification" in window) {
        setPushGranted(Notification.permission === "granted");
      } else {
        setPushGranted(false);
      }
    } catch (e) {
      console.warn("Could not check push permissions", e);
    }
  };

  const handleEnablePush = async () => {
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt" || permStatus.receive === "prompt-with-rationale") {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === "granted") {
          setPushGranted(true);
          await PushNotifications.register();
          toast("Notifications Enabled!", { icon: "✅" });
        } else {
          toast("Permission Denied", { description: "Please enable notifications in your phone's settings.", icon: "❌" });
        }
        return;
      }

      if (!("Notification" in window)) {
        toast("Not Supported", { description: "This browser can't receive push notifications." });
        return;
      }

      if (Notification.permission === "denied") {
        toast("Permission Blocked", {
          description: "Notifications are blocked for this site. Re-allow them in your browser's site settings.",
          icon: "❌",
        });
        return;
      }

      // Same flow the app runs automatically on load — registers the FCM
      // service worker and saves a web push token.
      const ok = await enableWebPush();
      setPushGranted(ok);
      if (ok) {
        toast("Notifications Enabled!", { icon: "✅" });
      } else {
        toast("Couldn't Enable Notifications", {
          description: "Permission was not granted, or this browser blocked the push service.",
          icon: "❌",
        });
      }
    } catch (e: any) {
      toast("Error", { description: e.message, icon: "❌" });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePref = async (key: keyof typeof prefs) => {
    if (!session?.user?.id) return;
    
    const newValue = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: newValue }));

    try {
      const { error } = await supabase
        .from("players")
        .update({ [key]: newValue } as any)
        .eq("id", session.user.id);
      if (error) {
        setPrefs((prev) => ({ ...prev, [key]: !newValue }));
        throw error;
      }
    } catch (e: any) {
      console.error(e);
      toast("Failed to update preference", { icon: "❌" });
    }
  };

  const handleToggleLocal = (key: LocalPrefKey) => {
    const newValue = !localPrefs[key];
    setLocalPrefs(prev => ({ ...prev, [key]: newValue }));
    setLocalPref(key, newValue);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notification Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Master Push Toggle */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${pushGranted ? "bg-primary/10 text-primary" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                {pushGranted ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-bold text-foreground">Device Notifications</h4>
                <p className="text-xs text-muted-foreground">Receive push alerts on this device</p>
              </div>
            </div>
            {pushGranted ? (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 px-2.5 py-1 rounded-full">Enabled</span>
            ) : (
              <Button onClick={handleEnablePush} disabled={loading} size="sm" variant="outline" className="font-bold text-xs h-8">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Enable"}
              </Button>
            )}
          </div>

          {/* ── Live Alert Categories ── */}
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-3">Live Alerts</h4>
            <CategoryItem
              icon={<Trophy className="w-4 h-4 text-amber-400" />}
              iconBg="bg-amber-400/10"
              title="Match Results"
              description="Tournament match scores when submitted"
              checked={localPrefs.match_results}
              onCheckedChange={() => handleToggleLocal("match_results")}
            />
            <CategoryItem
              icon={<Swords className="w-4 h-4 text-sky-400" />}
              iconBg="bg-sky-400/10"
              title="Tournament Match Started"
              description="When a tournament match goes live"
              checked={localPrefs.tournament_started}
              onCheckedChange={() => handleToggleLocal("tournament_started")}
            />
            <CategoryItem
              icon={<Megaphone className="w-4 h-4 text-indigo-400" />}
              iconBg="bg-indigo-400/10"
              title="Club Announcements"
              description="New announcements from club admins"
              checked={localPrefs.announcements}
              onCheckedChange={() => handleToggleLocal("announcements")}
            />
            <CategoryItem
              icon={<ShieldAlert className="w-4 h-4 text-rose-400" />}
              iconBg="bg-rose-400/10"
              title="Admin Alerts"
              description="Important notices pushed by admins"
              checked={localPrefs.admin_push}
              onCheckedChange={() => handleToggleLocal("admin_push")}
            />
          </div>

          {/* ── Activity Preferences ── */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Activity</h4>
            <PreferenceItem
              title="Match Confirmations"
              description="When someone confirms a match you logged"
              checked={prefs.pref_notify_point}
              onCheckedChange={() => handleTogglePref("pref_notify_point")}
            />
            <PreferenceItem
              title="Match Notifications"
              description="When a match is logged against you"
              checked={prefs.pref_notify_smash}
              onCheckedChange={() => handleTogglePref("pref_notify_smash")}
            />
            <PreferenceItem
              title="Match Requests"
              description="Pings and requests to play"
              checked={prefs.pref_notify_serve}
              onCheckedChange={() => handleTogglePref("pref_notify_serve")}
            />
            <PreferenceItem
              title="Achievements"
              description="ELO milestones and top 10 rankings"
              checked={prefs.pref_notify_victory}
              onCheckedChange={() => handleTogglePref("pref_notify_victory")}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryItem({
  icon, iconBg, title, description, checked, onCheckedChange
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-foreground">{title}</h5>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
    </div>
  );
}

function PreferenceItem({ title, description, checked, onCheckedChange }: { title: string, description: string, checked: boolean, onCheckedChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 p-1">
      <div>
        <h5 className="text-sm font-semibold text-foreground">{title}</h5>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
