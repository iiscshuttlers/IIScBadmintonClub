import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Holiday {
  date: string;
  name: string;
}

export function HolidayCalendarModal({ onClose }: { onClose: () => void }) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    supabase
      .from("site_data")
      .select("value")
      .eq("key", "holidays")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const val = data.value as any;
          setHolidays(Array.isArray(val) ? val : (val.holidays || []));
        }
        setLoading(false);
      });
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const holidayMap: Record<string, string> = {};
  holidays.forEach(h => { if (h.date) holidayMap[h.date] = h.name; });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthStr = currentDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const upcomingHolidays = holidays
    .filter(h => h.date && new Date(h.date) >= new Date(today.toDateString()))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border-b border-slate-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h3 className="font-black text-white text-base">Holiday Calendar</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-black text-white">{monthStr}</span>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="text-center text-[10px] font-black text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const holidayName = holidayMap[dateStr];
                const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
                const isSunday = new Date(year, month, day).getDay() === 0;
                return (
                  <div
                    key={idx}
                    title={holidayName}
                    className={`relative flex items-center justify-center h-8 rounded-lg text-xs font-bold transition-all ${
                      isToday ? "bg-primary text-primary-foreground" :
                      holidayName ? "bg-red-900/60 text-red-300 ring-1 ring-red-500/40" :
                      isSunday ? "text-red-400" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {day}
                    {holidayName && !isToday && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Upcoming holidays list */}
          {upcomingHolidays.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Upcoming Holidays</p>
              {upcomingHolidays.map((h, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-slate-800/60 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-200 flex-1">{h.name}</span>
                  <span className="text-[10px] font-black text-slate-500">
                    {new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
