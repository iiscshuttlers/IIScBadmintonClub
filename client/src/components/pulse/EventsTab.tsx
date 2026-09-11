import { useState, useEffect } from "react";
import { TournamentsScrollView } from "./TournamentsScrollView";
import ScheduleCalendar from "@/pages/ScheduleCalendar";
import { Calendar, Trophy } from "lucide-react";

export function EventsTab({ liveEvents = [], upcomingEvents = [], completedEvents = [], renderCard }: any) {
  const getInitialParam = (param: string, defaultVal: string) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param) || defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const [activeTab, setActiveTab] = useState<any>(() => getInitialParam("events_tab", "tournaments"));

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("events_tab", activeTab);
      window.history.replaceState(null, "", url.toString());
    } catch { /* ignore */ }
  }, [activeTab]);

  return (
    <div className="container mx-auto px-4 max-w-5xl mt-8">
      <div className="flex justify-center mb-8">
        <div className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl flex gap-1 border border-slate-200 dark:border-slate-800 w-full sm:w-auto max-w-sm">
          <button
            onClick={() => setActiveTab("tournaments" as any)}
            className={`flex-1 flex justify-center items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === "tournaments"
                ? "bg-white dark:bg-slate-700 text-blue-900 dark:text-foreground shadow-sm"
                : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            <Trophy className="w-4 h-4" /> Tournaments
          </button>
          <button
            onClick={() => setActiveTab("calendar" as any)}
            className={`flex-1 flex justify-center items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === "calendar"
                ? "bg-white dark:bg-slate-700 text-blue-900 dark:text-foreground shadow-sm"
                : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            <Calendar className="w-4 h-4" /> Calendar
          </button>
        </div>
      </div>

      {activeTab === "tournaments" ? (
         <TournamentsScrollView 
           liveEvents={liveEvents} 
           upcomingEvents={upcomingEvents} 
           completedEvents={completedEvents} 
           renderCard={renderCard} 
         />
      ) : (
         <ScheduleCalendar />
      )}
    </div>
  );
}
