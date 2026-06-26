import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle,
  Clock,
  MapPin,
  Trophy,
  Users,
  CalendarX,
  ExternalLink,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchSiteData } from "@/lib/siteData";
import { motion } from "framer-motion";

type Holiday = {
  date: string;
  name: string;
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: "easeOut" as const },
  }),
};

export function FacilitiesSection() {

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [nextHoliday, setNextHoliday] = useState<Holiday | null>(null);

  const { data: queryHolidays = [] } = useQuery({
    queryKey: ["holidays"],
    queryFn: () => fetchSiteData<Holiday[]>("holidays", "holidays.json"),
    refetchInterval: 300_000,
  });

  useEffect(() => {
    if (queryHolidays.length > 0) {
      const sortedData = [...queryHolidays].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      setHolidays(sortedData);
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });
      setNextHoliday(sortedData.find((h: any) => h.date >= today) || null);
    }
  }, [queryHolidays]);

  const courtDetails = [
    "Wooden flooring with synthetic mat overlay",
    "Professional BWF-standard court markings",
    "Bright LED lighting for evening sessions",
    "Tournament-ready infrastructure",
  ];

  const schedule = [
    { day: "Monday – Sunday", hours: "6:00 AM – 10:20 PM", note: "All days" },
    { day: "Gymkhana Holidays", hours: "Closed", note: "See calendar below" },
  ];

  return (
    <section className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 w-full">
      <div className="w-full">
        {/* Courts + Hours */}
        <section className="py-14 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Courts card */}
              <motion.div
                custom={0}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div className="h-full rounded-3xl border-2 border-emerald-100 dark:border-emerald-900/50 shadow-md bg-white dark:bg-slate-800 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600" />
                  <div className="p-8">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h2 className="text-2xl font-black text-blue-900 dark:text-white">
                        Indoor Courts
                      </h2>
                    </div>
                    <p className="text-gray-600 dark:text-slate-400 leading-relaxed mb-6">
                      Three professional-grade wooden courts with synthetic mat
                      flooring and modern lighting, designed for both training
                      and competitive play.
                    </p>
                    <ul className="space-y-3">
                      {courtDetails.map((detail, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-slate-300 text-sm">
                            {detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>

              {/* Hours card */}
              <motion.div
                custom={1}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div className="h-full rounded-3xl border-2 border-blue-100 dark:border-blue-900/50 shadow-md bg-white dark:bg-slate-800 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-700" />
                  <div className="p-8">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h2 className="text-2xl font-black text-blue-900 dark:text-white">
                        Operating Hours
                      </h2>
                    </div>
                    <div className="space-y-3 mb-4">
                      {schedule.map((slot, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-4 rounded-2xl ${
                            idx === 0
                              ? "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/50"
                              : "bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border border-red-100 dark:border-red-900/50"
                          }`}
                        >
                          <div>
                            <p
                              className={`font-bold text-sm ${idx === 0 ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-400"}`}
                            >
                              {slot.day}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                              {slot.note}
                            </p>
                          </div>
                          <span
                            className={`font-black text-sm tabular-nums ${idx === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                          >
                            {slot.hours}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-red-500 dark:text-red-400 font-medium">
                      ✕ Closed on all Gymkhana-declared holidays — see the
                      calendar below.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Court Closure Days */}
        <section className="py-14 bg-slate-50 dark:bg-slate-900/50">
          <div className="container mx-auto px-4 max-w-6xl">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-8 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
              <h2 className="text-2xl font-black text-blue-900 dark:text-white">
                Court Closure Days — {new Date().getFullYear()}
              </h2>
              <CalendarX className="w-5 h-5 text-red-500" />
            </div>

            {/* Next Closure highlight */}
            {nextHoliday && (
              <motion.div
                custom={0}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="mb-8 bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md relative overflow-hidden"
              >
                <div className="absolute inset-0 hero-pattern opacity-30" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white/60 uppercase tracking-widest">
                        Next Closure
                      </p>
                      <p className="font-black text-white">
                        {nextHoliday.name}
                      </p>
                    </div>
                  </div>
                  <div className="sm:ml-auto bg-white/10 border border-white/20 px-4 py-2 rounded-xl">
                    <p className="text-sm font-bold text-amber-300">
                      {nextHoliday.date}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Holiday grid */}
            {holidays.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {holidays.map((h, i) => {
                  const today = new Date().toLocaleDateString("en-CA", {
                    timeZone: "Asia/Kolkata",
                  });
                  const isPast = h.date < today;
                  const isNext = nextHoliday?.date === h.date;

                  return (
                    <motion.div
                      key={i}
                      custom={i}
                      variants={fadeUp}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      className={`rounded-2xl p-5 text-center border transition-shadow hover:shadow-md ${
                        isNext
                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 shadow-sm"
                          : isPast
                            ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
                      }`}
                    >
                      <p
                        className={`text-xs font-bold tabular-nums ${isNext ? "text-amber-600 dark:text-amber-400" : isPast ? "text-slate-400 dark:text-slate-500" : "text-gray-500 dark:text-slate-400"}`}
                      >
                        {h.date}
                      </p>
                      <p
                        className={`text-xs font-semibold mt-1.5 leading-snug ${isNext ? "text-amber-800 dark:text-amber-300" : isPast ? "text-slate-400 dark:text-slate-500" : "text-blue-900 dark:text-slate-200"}`}
                      >
                        {h.name}
                      </p>
                      {isNext && (
                        <span className="mt-2 inline-block text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Next →
                        </span>
                      )}
                      {isPast && (
                        <span className="mt-2 inline-block text-[10px] text-slate-400 dark:text-slate-600">
                          Past
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400 dark:text-slate-500">
                Loading closure dates…
              </div>
            )}

            <p className="mt-8 text-center text-sm text-gray-500 dark:text-slate-500">
              * Dates may change as per Government announcements
            </p>
          </div>
        </section>

        {/* Location + Membership */}
        <section className="py-14 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Location */}
              <motion.div
                custom={0}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div className="h-full rounded-3xl border border-slate-100 dark:border-slate-700 shadow-md bg-white dark:bg-slate-800 overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />
                  <div className="p-8">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-blue-700 dark:text-blue-400" />
                      </div>
                      <h2 className="text-2xl font-black text-blue-900 dark:text-white">
                        Location
                      </h2>
                    </div>
                    <h3 className="font-bold text-blue-900 dark:text-white text-base mb-2">
                      IISc Gymkhana Badminton Courts
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 leading-relaxed mb-2">
                      Indian Institute of Science
                      <br />
                      Bangalore — 560012
                      <br />
                      India
                    </p>
                    <p className="text-gray-500 dark:text-slate-500 text-sm mb-6">
                      Located within the IISc campus with easy access, ample
                      parking, and excellent connectivity.
                    </p>
                    <a
                      href="https://maps.app.goo.gl/pBTtJGYEPwnu6qd78"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 shadow-md shadow-emerald-500/20"
                    >
                      <MapPin className="w-4 h-4" />
                      Open in Google Maps
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </motion.div>

              {/* Membership */}
              <motion.div
                custom={1}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div className="h-full rounded-3xl border border-slate-100 dark:border-slate-700 shadow-md bg-white dark:bg-slate-800 overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600" />
                  <div className="p-8">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                        <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h2 className="text-2xl font-black text-blue-900 dark:text-white">
                        Membership & Access
                      </h2>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 mb-5">
                      <h3 className="font-black text-emerald-700 dark:text-emerald-400 text-sm uppercase tracking-wider mb-2">
                        IISc Members
                      </h3>
                      <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                        Students, faculty, staff, and eligible members can
                        access the badminton facilities through Gymkhana
                        membership.
                      </p>
                    </div>

                    <ul className="space-y-3">
                      {[
                        "Full facility access (all 3 courts)",
                        "Tournament participation eligibility",
                        "Join the IISc badminton community online",
                      ].map((item, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-slate-300 text-sm">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
