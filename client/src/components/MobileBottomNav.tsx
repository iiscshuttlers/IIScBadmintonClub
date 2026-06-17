import { Home, Activity, Plus, Users, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

export default function MobileBottomNav() {
  const { profile } = useAuth();
  const [location, setLocation] = useLocation();

  if (!profile) return null;

  // Hide on admin screens
  if (location.startsWith("/admin")) return null;

  const handleNav = async (path: string) => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch (e) {
      /* ignore */
    }
    setLocation(path);
  };

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pt-1">
        <div className="flex items-center justify-around px-2 pb-4">
          {/* HOME */}
          <button
            onClick={() => handleNav("/")}
            className={`relative flex flex-col items-center justify-center w-16 h-14 transition-all duration-200 ${location === "/" ? "text-emerald-600 dark:text-emerald-400 scale-110" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            {location === "/" && (
              <span className="absolute top-0.5 inset-x-1 h-full rounded-xl bg-emerald-50 dark:bg-emerald-900/25 -z-0" />
            )}
            <Home
              className={`w-6 h-6 mb-1 relative z-10 ${location === "/" ? "fill-emerald-500/20" : ""}`}
              strokeWidth={location === "/" ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold relative z-10">Home</span>
          </button>

          {/* FEED */}
          <button
            onClick={() => handleNav("/feed")}
            className={`relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-200 ${location === "/feed" ? "text-emerald-600 dark:text-emerald-400 scale-110" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            {location === "/feed" && (
              <span className="absolute top-0.5 inset-x-1 h-full rounded-xl bg-emerald-50 dark:bg-emerald-900/25 -z-0" />
            )}
            <Activity
              className={`w-6 h-6 mb-1 relative z-10 ${location === "/feed" ? "stroke-emerald-500" : ""}`}
              strokeWidth={location === "/feed" ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold relative z-10">Feed</span>
          </button>

          {/* LOG MATCH (Center FAB-style) */}
          <div className="relative -top-5 mx-1">
            <button
              onClick={async () => {
                try {
                  if (Capacitor.isNativePlatform()) {
                    await Haptics.impact({ style: ImpactStyle.Heavy });
                  }
                } catch (e) {
                  /* ignore */
                }
                window.dispatchEvent(new Event("openLogMatchModal"));
              }}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all ring-4 ring-white dark:ring-slate-900"
            >
              <Plus className="w-7 h-7" strokeWidth={3} />
            </button>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              Log Match
            </span>
          </div>

          {/* PLAYERS */}
          <button
            onClick={() => handleNav("/players")}
            className={`relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-200 ${location.startsWith("/players") ? "text-emerald-600 dark:text-emerald-400 scale-110" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            {location.startsWith("/players") && (
              <span className="absolute top-0.5 inset-x-1 h-full rounded-xl bg-emerald-50 dark:bg-emerald-900/25 -z-0" />
            )}
            <Users
              className={`w-6 h-6 mb-1 relative z-10 ${location.startsWith("/players") ? "fill-emerald-500/20" : ""}`}
              strokeWidth={location.startsWith("/players") ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold relative z-10">Players</span>
          </button>

          {/* EVENTS */}
          <button
            onClick={() => handleNav("/events")}
            className={`relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-200 ${location.startsWith("/events") ? "text-emerald-600 dark:text-emerald-400 scale-110" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            {location.startsWith("/events") && (
              <span className="absolute top-0.5 inset-x-1 h-full rounded-xl bg-emerald-50 dark:bg-emerald-900/25 -z-0" />
            )}
            <CalendarDays
              className={`w-6 h-6 mb-1 relative z-10 ${location.startsWith("/events") ? "fill-emerald-500/20" : ""}`}
              strokeWidth={location.startsWith("/events") ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold relative z-10">Events</span>
          </button>
        </div>
      </div>
    </>
  );
}
