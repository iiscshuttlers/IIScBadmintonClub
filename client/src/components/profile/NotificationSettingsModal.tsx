import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { playerService } from "@/services/playerService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Bell, BellRing, BellOff, Loader2, Trophy, Megaphone, ShieldAlert, Swords, ChevronDown } from "lucide-react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { useQuery } from "@tanstack/react-query";
import { enableWebPush } from "@/hooks/usePushNotifications";
import { useGalleryAlerts } from "@/hooks/useGalleryAlerts";
import { fetchRemoteGalleryImages } from "@/lib/galleryStorage";
import {
  albumAlertSummary,
  albumLabel,
  alertableAlbums,
  allAlbumsOn,
  planAlbumToggle,
  planAllOff,
  planAllOn,
  type AlertPlan,
} from "@/lib/galleryAlerts";

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
    pref_receive_push:   profile?.pref_receive_push   ?? true,
    pref_receive_email:  profile?.pref_receive_email  ?? true,
    pref_notify_smash:   profile?.pref_notify_smash   ?? true,
    pref_notify_point:   profile?.pref_notify_point   ?? true,
    pref_notify_serve:   profile?.pref_notify_serve   ?? true,
    pref_notify_whistle: profile?.pref_notify_whistle ?? true,
    pref_notify_victory: profile?.pref_notify_victory ?? true,
    pref_notify_buddy_status: profile?.pref_notify_buddy_status ?? true,
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
          // Also flip the app-level master preference back on, so toggling push
          // off and then re-enabling from here actually restores delivery.
          if (!prefs.pref_receive_push) await handleTogglePref("pref_receive_push");
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
        if (!prefs.pref_receive_push) await handleTogglePref("pref_receive_push");
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
      const { error } = await playerService.updateNotificationPreferences(session.user.id, { [key]: newValue } as any);
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
          {/* Master Email Toggle */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${prefs.pref_receive_email ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {prefs.pref_receive_email ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-bold text-foreground">Email Notifications</h4>
                <p className="text-xs text-muted-foreground">Receive important alerts via email</p>
              </div>
            </div>
            <Switch checked={prefs.pref_receive_email} onCheckedChange={() => handleTogglePref("pref_receive_email")} />
          </div>

          {/* Master Push Toggle (System + App Preference) */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${pushGranted && prefs.pref_receive_push ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {pushGranted && prefs.pref_receive_push ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-bold text-foreground">Push Notifications</h4>
                <p className="text-xs text-muted-foreground">Receive push alerts on this device</p>
              </div>
            </div>
            {!pushGranted ? (
              <Button onClick={handleEnablePush} disabled={loading} size="sm" variant="outline" className="font-bold text-xs h-8">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Enable"}
              </Button>
            ) : (
              <Switch checked={prefs.pref_receive_push} onCheckedChange={() => handleTogglePref("pref_receive_push")} />
            )}
          </div>

          {/* ── In-app pop-ups (this device only, while the app is open) ── */}
          <div className="space-y-1">
            <div className="px-1 mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">In-app pop-ups</h4>
              <p className="text-[11px] text-muted-foreground">Shown on this device while the app is open</p>
            </div>
            <CategoryItem
              icon={<Trophy className="w-4 h-4 text-gold" />}
              iconBg="bg-gold/10"
              title="Match Results"
              description="Tournament match scores when submitted"
              checked={localPrefs.match_results}
              onCheckedChange={() => handleToggleLocal("match_results")}
            />
            <CategoryItem
              icon={<Swords className="w-4 h-4 text-info" />}
              iconBg="bg-info/10"
              title="Tournament Match Started"
              description="When a tournament match goes live"
              checked={localPrefs.tournament_started}
              onCheckedChange={() => handleToggleLocal("tournament_started")}
            />
            <CategoryItem
              icon={<Megaphone className="w-4 h-4 text-info" />}
              iconBg="bg-info/10"
              title="Club Announcements"
              description="New announcements from club admins"
              checked={localPrefs.announcements}
              onCheckedChange={() => handleToggleLocal("announcements")}
            />
            <CategoryItem
              icon={<ShieldAlert className="w-4 h-4 text-danger" />}
              iconBg="bg-danger/10"
              title="Admin Alerts"
              description="Important notices pushed by admins"
              checked={localPrefs.admin_push}
              onCheckedChange={() => handleToggleLocal("admin_push")}
            />
          </div>

          {/* ── Push categories (saved to the account; the server checks them before sending) ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Push alerts</h4>
              {Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && (
                <span className="text-[10px] text-muted-foreground italic">
                  * Customize sounds in Android Settings
                </span>
              )}
            </div>
            <PreferenceItem
              title="Announcements"
              description="Club announcements, organiser notices and live match updates"
              checked={prefs.pref_notify_whistle}
              onCheckedChange={() => handleTogglePref("pref_notify_whistle")}
            />
            <GalleryAlertRow open={open} />
            <PreferenceItem
              title="Match Confirmations"
              description="When someone confirms a match you logged"
              checked={prefs.pref_notify_point}
              onCheckedChange={() => handleTogglePref("pref_notify_point")}
            />
            <PreferenceItem
              title="Match Reminders"
              description="Before your matches, and when you're up next on court"
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
              title="Followers"
              description="New followers, and buddies who are looking to play"
              checked={prefs.pref_notify_buddy_status}
              onCheckedChange={() => handleTogglePref("pref_notify_buddy_status")}
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
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-card/60 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-foreground">{title}</h5>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} className="shrink-0" />
    </div>
  );
}

/**
 * New-photo alerts as one row in Push alerts: it shows how many albums are on
 * and opens the album list, with "Turn all on/off" at the top. The album bells
 * in the gallery change the same settings.
 */
function GalleryAlertRow({ open }: { open: boolean }) {
  const alerts = useGalleryAlerts();
  const [expanded, setExpanded] = useState(false);
  const { data: photos = [] } = useQuery({
    queryKey: ["gallery-remote-photos"],
    queryFn: fetchRemoteGalleryImages,
    enabled: open,
  });
  const albums = alertableAlbums(photos);
  const names = albums.map((a) => a.album);
  const allOn = allAlbumsOn(names, alerts.state);

  const run = (plan: AlertPlan, failure: string) => {
    alerts.applyPlan(plan).catch((err) => {
      console.error(err);
      toast(failure, { icon: "❌" });
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="gallery-album-alerts"
        className="flex w-full items-center justify-between gap-4 rounded-lg p-1 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-foreground">Gallery photos</h5>
          <p className="text-xs text-muted-foreground">When photos are added to an album</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
          {albumAlertSummary(names, alerts.state)}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>

      {expanded && (
        <div id="gallery-album-alerts" className="ml-1 mt-2 space-y-2 border-l border-border pl-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              {alerts.enabled ? "New albums are included" : "Off for every album, including new ones"}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 text-xs font-bold"
              onClick={() =>
                run(allOn ? planAllOff(alerts.state) : planAllOn(alerts.state), "Couldn't update photo alerts")
              }
            >
              {allOn ? "Turn all off" : "Turn all on"}
            </Button>
          </div>
          {albums.length === 0 && <p className="text-xs text-muted-foreground">No albums yet.</p>}
          {albums.map(({ album, category }) => {
            const on = alerts.isOn(album);
            const mutedForMe = alerts.isMutedForMe(album);
            return (
              <div key={album} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{albumLabel(album)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {mutedForMe ? "Muted for everyone by admins" : albumLabel(category)}
                  </p>
                </div>
                <Switch
                  checked={on}
                  onCheckedChange={() =>
                    run(planAlbumToggle(album, names, alerts.state), `Couldn't update ${albumLabel(album)}`)
                  }
                  aria-label={`Alerts for ${albumLabel(album)}`}
                  className="shrink-0"
                />
              </div>
            );
          })}
        </div>
      )}
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
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} className="shrink-0" />
    </div>
  );
}
