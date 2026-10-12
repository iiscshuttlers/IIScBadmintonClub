import ScheduleCalendar from "@/pages/ScheduleCalendar";
import { Calendar, Trophy } from "lucide-react";

export function EventsTab() {

  return (
    <div className="container mx-auto px-4 max-w-5xl mt-8">
      {/* Canonical Hub Banner */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-primary/10 to-teal-500/10 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Explore the Official Tournaments Hub</h3>
            <p className="text-xs text-muted-foreground">Registration, brackets, live order-of-play, and tournament organization tools.</p>
          </div>
        </div>
        <a
          href="/tournaments"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-slate-950 font-bold text-xs hover:bg-primary/90 transition-all shadow-sm flex-shrink-0"
        >
          Go to Tournaments Hub →
        </a>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground">Court & Club Calendar</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Club bookings, open sessions, and tournament schedules.</p>
        </div>
        <a
          href="/tournaments"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-slate-950 font-bold text-xs hover:bg-primary/90 transition-all shadow-sm"
        >
          <Trophy className="w-4 h-4" /> Go to Tournaments Hub →
        </a>
      </div>

      <ScheduleCalendar />
    </div>
  );
}
