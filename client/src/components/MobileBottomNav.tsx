import { useState, useEffect } from "react";
import { Home, Swords, Users, Activity, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import LogMatchModal from "./LogMatchModal";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

export default function MobileBottomNav() {
  const { profile } = useAuth();
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState<any[]>([]);

  useEffect(() => {
    const handleOpenLogMatch = () => setIsOpen(true);
    window.addEventListener("openLogMatchModal", handleOpenLogMatch);
    return () =>
      window.removeEventListener("openLogMatchModal", handleOpenLogMatch);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("players")
      .select("id, full_name, avatar_url, gender")
      .neq("id", profile.id)
      .is("deleted_at", null)
      .order("full_name")
      .then(({ data }) => {
        if (data) setOtherPlayers(data);
      });
  }, [profile?.id]);

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
        <div className="flex items-center justify-around px-2 pb-2">
          {/* HOME */}
          <button
            onClick={() => handleNav("/")}
            className={`flex flex-col items-center justify-center w-16 h-12 transition-colors ${location === "/" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            <Home
              className={`w-6 h-6 mb-1 ${location === "/" ? "fill-emerald-500/20" : ""}`}
              strokeWidth={location === "/" ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold">Home</span>
          </button>

          {/* FEED */}
          <button
            onClick={() => handleNav("/feed")}
            className={`flex flex-col items-center justify-center w-14 h-12 transition-colors ${location === "/feed" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            <Activity
              className={`w-6 h-6 mb-1 ${location === "/feed" ? "stroke-emerald-500" : ""}`}
              strokeWidth={location === "/feed" ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold">Feed</span>
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
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              Log Match
            </span>
          </div>

          {/* MATCHES */}
          <button
            onClick={() => handleNav("/matches")}
            className={`flex flex-col items-center justify-center w-14 h-12 transition-colors ${location.startsWith("/matches") ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            <Swords
              className={`w-6 h-6 mb-1 ${location.startsWith("/matches") ? "fill-emerald-500/20" : ""}`}
              strokeWidth={location.startsWith("/matches") ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold">Matches</span>
          </button>

          {/* PLAYERS DIRECTORY */}
          <button
            onClick={() => handleNav("/players")}
            className={`flex flex-col items-center justify-center w-14 h-12 transition-colors ${location === "/players" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            <Users
              className={`w-6 h-6 mb-1 ${location === "/players" ? "fill-emerald-500/20" : ""}`}
              strokeWidth={location === "/players" ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold">Players</span>
          </button>
        </div>
      </div>

      {/* Modal */}
      <LogMatchModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUser={profile as any}
        otherPlayers={otherPlayers}
        onSuccess={() => setIsOpen(false)}
      />
    </>
  );
}
