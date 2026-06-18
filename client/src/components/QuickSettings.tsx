import { useState, useEffect } from "react";
import { Settings, Palette, Activity, Check, Lock, Bell, BellOff, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function QuickSettingsContent({ onClose }: { onClose?: () => void }) {
  const { accent, setAccent } = useTheme();
  const { profile, session, refreshProfile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [notifsExpanded, setNotifsExpanded] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/app-version.json?v=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => { if (data?.versionName) setAppVersion(data.versionName); })
      .catch(() => {});
  }, []);

  // ── Notification preferences (localStorage + DB sync) ───────────
  const NOTIF_KEYS = [
    { key: "notify_smash",        label: "Match notifications",       storage: "iisc_notify_smash" },
    { key: "notify_point",        label: "Match confirmations",       storage: "iisc_notify_point" },
    { key: "notify_serve",        label: "Match requests (Pings)",    storage: "iisc_notify_serve" },
    { key: "notify_whistle",      label: "Announcements & Live",      storage: "iisc_notify_whistle" },
    { key: "notify_victory",      label: "Achievements & Milestones", storage: "iisc_notify_victory" },
    { key: "notify_weekly_digest",label: "Weekly digest (email)",     storage: "iisc_notify_weekly_digest" },
  ] as const;

  type NotifKey = typeof NOTIF_KEYS[number]["key"];

  const [notifPrefs, setNotifPrefs] = useState<Record<NotifKey, boolean>>(() => {
    const prefs = {} as Record<NotifKey, boolean>;
    for (const n of NOTIF_KEYS) {
      prefs[n.key] = localStorage.getItem(n.storage) !== "false";
    }
    return prefs;
  });

  const toggleNotif = async (key: NotifKey, storage: string) => {
    const next = !notifPrefs[key];
    setNotifPrefs((prev) => ({ ...prev, [key]: next }));
    localStorage.setItem(storage, String(next));
    if (profile?.id) {
      await supabase.from("players").update({ [`pref_${key}`]: next }).eq("id", profile.id).then(() => {});
    }
  };

  // Fallback status if none found
  const currentStatus = (profile as any)?.status || "looking";

  const updateStatus = async (newStatus: string) => {
    if (!profile?.id) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("players")
        .update({ status: newStatus })
        .eq("id", session?.user?.id);
      if (error) throw error;

      if (newStatus === "playing" && session?.user?.id) {
        const now = new Date();
        await supabase.from("court_visits").insert({
          user_id: session.user.id,
          visited_at: now.toISOString(),
          day_of_week: now.getDay(),
          hour: now.getHours(),
        });
      }

      if ((newStatus === "playing" || newStatus === "looking") && profile?.id) {
        supabase.functions.invoke("notify-social", {
          body: {
            type: "status_update",
            from_player_id: profile.id,
            from_name: profile.full_name || "A buddy",
            new_status: newStatus,
          },
        }).catch((err) => console.error("Failed to notify buddies of status update:", err));
      }

      await refreshProfile();
      toast.success("Live status updated!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    } finally {
      setUpdating(false);
      onClose?.();
    }
  };

  const statusConfig = [
    {
      id: "looking",
      label: "Looking to play",
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950",
    },
    {
      id: "playing",
      label: "Playing Right Now",
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950",
    },
    {
      id: "resting",
      label: "Taking a break",
      color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950",
    },
    {
      id: "injured",
      label: "Injured",
      color: "text-rose-500 bg-rose-50 dark:bg-rose-950",
    },
  ];

  const themes = [
    { id: "emerald", bg: "bg-emerald-500" },
    { id: "violet", bg: "bg-violet-500" },
    { id: "rose", bg: "bg-rose-500" },
    { id: "amber", bg: "bg-amber-500" },
    { id: "blue", bg: "bg-blue-500" },
    {
      id: "cyberpunk",
      bg: "bg-black border border-[#00ffcc] shadow-[0_0_8px_#00ffcc]",
    },
  ];

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {/* APP THEME COLOR */}
      <div className="px-3 py-3">
        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Palette className="w-3 h-3" /> App Theme Color
        </div>
        <div className="flex items-center gap-2.5">
          {themes.map((color) => (
            <div
              key={color.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAccent?.(color.id as any);
              }}
              className={`w-7 h-7 rounded-full cursor-pointer transition-all ${color.bg} ${
                accent === color.id
                  ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-slate-700 dark:ring-white scale-115"
                  : "hover:scale-110 opacity-60 hover:opacity-100"
              }`}
              title={`Theme: ${color.id}`}
            />
          ))}
        </div>
      </div>

      {profile?.id && (
        <>
          {/* LIVE STATUS */}
          <div className="px-3 py-3">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> Live Status
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {statusConfig.map((status) => {
                const isActive = currentStatus === status.id;
                return (
                  <button
                    key={status.id}
                    disabled={updating}
                    onClick={(e) => {
                      e.preventDefault();
                      updateStatus(status.id);
                    }}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? status.color + " shadow-sm ring-1 ring-current/20"
                        : "text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate">{status.label}</span>
                    {isActive && <Check className="w-3 h-3 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* NOTIFICATION PREFERENCES */}
          <div className="px-3 py-3">
            <button
              onClick={(e) => {
                e.preventDefault();
                setNotifsExpanded(!notifsExpanded);
              }}
              className="w-full flex items-center justify-between text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2"
            >
              <span className="flex items-center gap-1.5"><Bell className="w-3 h-3" /> Notifications</span>
              {notifsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            
            {notifsExpanded && (
              <div className="flex flex-col gap-1 mt-2">
                {NOTIF_KEYS.map(({ key, label, storage }) => {
                  const val = notifPrefs[key];
                  return (
                    <button
                      key={key}
                      onClick={(e) => {
                        e.preventDefault();
                        toggleNotif(key, storage);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <span className={val ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}>{label}</span>
                      <div className={`w-8 h-4.5 rounded-full relative transition-colors shrink-0 ${val ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                        <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${val ? "left-4.5" : "left-0.5"}`} />
                      </div>
                    </button>
                  );
                })}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const allOn = NOTIF_KEYS.every(({ key }) => notifPrefs[key]);
                    NOTIF_KEYS.forEach(({ key, storage }) => {
                      setNotifPrefs((prev) => ({ ...prev, [key]: !allOn }));
                      localStorage.setItem(storage, String(!allOn));
                    });
                  }}
                  className="mt-2 w-full text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition text-center py-1"
                >
                  {NOTIF_KEYS.every(({ key }) => notifPrefs[key]) ? "Mute all" : "Enable all"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {/* APP VERSION */}
      {appVersion && (
        <div className="px-3 py-2.5 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3 h-3" /> App Version
          </span>
          <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            v{appVersion}
          </span>
        </div>
      )}
    </div>
  );
}
