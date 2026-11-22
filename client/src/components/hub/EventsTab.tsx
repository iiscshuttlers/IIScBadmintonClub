import ScheduleCalendar from "@/pages/ScheduleCalendar";
import { Link } from "wouter";
import { CalendarHeart, Trophy } from "lucide-react";

/** Club → Calendar (was Pulse → Calendar): court bookings, sessions and tournament schedules. */
export function EventsTab() {
  return (
    <div className="container mx-auto px-4 max-w-5xl mt-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground">Court & Club Calendar</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Club bookings, open sessions, and tournament schedules.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The holiday calendar lived in the top bar; Navigation still owns the modal. */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("openHolidays"))}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-success/15 text-success border border-success/30 font-bold text-xs hover:bg-success/25 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
          >
            <CalendarHeart className="w-4 h-4" aria-hidden /> Holidays
          </button>
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-sm"
          >
            <Trophy className="w-4 h-4" aria-hidden /> Tournaments →
          </Link>
        </div>
      </div>

      <ScheduleCalendar />
    </div>
  );
}
