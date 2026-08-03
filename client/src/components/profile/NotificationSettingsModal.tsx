import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Bell, BellRing, BellOff, Loader2 } from "lucide-react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

interface NotificationSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationSettingsModal({ open, onOpenChange }: NotificationSettingsModalProps) {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);

  // Preference states mapped to existing columns in public.players
  const [prefs, setPrefs] = useState({
    pref_notify_smash: profile?.pref_notify_smash ?? true,
    pref_notify_point: profile?.pref_notify_point ?? true,
    pref_notify_serve: profile?.pref_notify_serve ?? true,
    pref_notify_whistle: profile?.pref_notify_whistle ?? true,
    pref_notify_victory: profile?.pref_notify_victory ?? true,
  });

  useEffect(() => {
    if (open && Capacitor.isNativePlatform()) {
      checkPermissions();
    }
  }, [open]);

  const checkPermissions = async () => {
    try {
      const { receive } = await PushNotifications.checkPermissions();
      setPushGranted(receive === "granted");
    } catch (e) {
      console.warn("Could not check push permissions", e);
    }
  };

  const handleEnablePush = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast("Not Supported", { description: "Push notifications are only available on the mobile app." });
      return;
    }
    setLoading(true);
    try {
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
        .update({ [key]: newValue })
        .eq("id", session.user.id);
      
      if (error) {
        // revert on error
        setPrefs((prev) => ({ ...prev, [key]: !newValue }));
        throw error;
      }
    } catch (e: any) {
      console.error(e);
      toast("Failed to update preference", { icon: "❌" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Alert Preferences</h4>
            
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
              title="Announcements"
              description="Club announcements and live match alerts"
              checked={prefs.pref_notify_whistle}
              onCheckedChange={() => handleTogglePref("pref_notify_whistle")}
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
