import ScheduleCalendar from "@/pages/ScheduleCalendar";
import { Link } from "wouter";
import { Trophy } from "lucide-react";

export function EventsTab() {

  return (
    <div className="container mx-auto px-4 max-w-5xl mt-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground">Court & Club Calendar</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Club bookings, open sessions, and tournament schedules.</p>
        </div>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-sm"
        >
          <Trophy className="w-4 h-4" /> Tournaments →
        </Link>
      </div>

      <ScheduleCalendar />
    </div>
  );
}
