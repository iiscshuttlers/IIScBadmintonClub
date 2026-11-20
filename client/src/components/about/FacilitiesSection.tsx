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
import { CourtScheduleSection } from "./CourtScheduleSection";

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
    refetchInterval: (query) => (query.state.error ? false : 300_000),
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
    <section className="bg-card border-t border-border w-full">
      <div className="w-full">
        {/* Courts + Hours */}
        <section className="py-6 bg-card">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              {/* Courts card */}
              <motion.div
                custom={0}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div className="h-full rounded-3xl border-2 border-primary/50 shadow-md bg-muted overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-1.5 bg-gradient-to-r from-primary to-team" />
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/30 flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-primary" />
                      </div>
                      <h2 className="text-2xl font-black text-foreground">
                        Indoor Courts
                      </h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      Three professional-grade wooden courts with synthetic mat
                      flooring and modern lighting, designed for both training
                      and competitive play.
                    </p>
                    <ul className="space-y-3">
                      {courtDetails.map((detail, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-soft text-sm">
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
                <div className="h-full rounded-3xl border-2 border-info/30 shadow-md bg-muted overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-1.5 bg-gradient-to-r from-info to-info" />
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-info/10 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-info" />
                      </div>
                      <h2 className="text-2xl font-black text-foreground">
                        Operating Hours
                      </h2>
                    </div>
                    <div className="space-y-3 mb-4">
                      {schedule.map((slot, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-2xl ${
                            idx === 0
                              ? "bg-gradient-to-r from-primary/20 to-team/10 border border-primary/50"
                              : "bg-gradient-to-r from-danger/10 to-secondary/10 border border-danger/30"
                          }`}
                        >
                          <div>
                            <p
                              className={`font-bold text-sm ${idx === 0 ? "text-primary/70" : "text-danger"}`}
                            >
                              {slot.day}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {slot.note}
                            </p>
                          </div>
                          <span
                            className={`font-black text-sm tabular-nums ${idx === 0 ? "text-primary" : "text-danger"}`}
                          >
                            {slot.hours}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-danger font-medium">
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
        <section className="py-6 bg-card/50">
          <div className="container mx-auto px-4 max-w-6xl">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-8 bg-gradient-to-b from-danger to-secondary rounded-full" />
              <h2 className="text-2xl font-black text-foreground">
                Court Closure Days — {new Date().getFullYear()}
              </h2>
              <CalendarX className="w-5 h-5 text-danger" />
            </div>

            {/* Next Closure highlight */}
            {nextHoliday && (
              <motion.div
                custom={0}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="mb-8 bg-gradient-to-r from-success to-primary on-fill p-5 rounded-2xl shadow-md relative overflow-hidden"
              >
                <div className="absolute inset-0 hero-pattern opacity-30" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-foreground/10 border border-foreground/20 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground/60 uppercase tracking-widest">
                        Next Closure
                      </p>
                      <p className="font-black text-foreground">
                        {nextHoliday.name}
                      </p>
                    </div>
                  </div>
                  <div className="sm:ml-auto bg-foreground/10 border border-foreground/20 px-4 py-2 rounded-xl">
                    <p className="text-sm font-bold text-foreground">
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
                          ? "bg-warning/10 border-warning shadow-sm"
                          : isPast
                            ? "bg-muted border-border-strong opacity-60"
                            : "bg-muted border-border-strong shadow-sm"
                      }`}
                    >
                      <p
                        className={`text-xs font-bold tabular-nums ${isNext ? "text-warning" : isPast ? "text-muted-foreground" : "text-muted-foreground"}`}
                      >
                        {h.date}
                      </p>
                      <p
                        className={`text-xs font-semibold mt-1.5 leading-snug ${isNext ? "text-warning" : isPast ? "text-muted-foreground" : "text-soft"}`}
                      >
                        {h.name}
                      </p>
                      {isNext && (
                        <span className="mt-2 inline-block text-[10px] font-black uppercase tracking-wider text-warning">
                          Next →
                        </span>
                      )}
                      {isPast && (
                        <span className="mt-2 inline-block text-[10px] text-muted-foreground">
                          Past
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                Loading closure dates…
              </div>
            )}

            <p className="mt-8 text-center text-sm text-muted-foreground">
              * Dates may change as per Government announcements
            </p>
          </div>
        </section>

        {/* Location + Membership */}
        <section className="py-6 bg-card">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              {/* Location */}
              <motion.div
                custom={0}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div className="h-full rounded-3xl border border-border-strong shadow-md bg-muted overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-info to-info" />
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-info/10 flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-info" />
                      </div>
                      <h2 className="text-2xl font-black text-foreground">
                        Location
                      </h2>
                    </div>
                    <h3 className="font-bold text-foreground text-base mb-2">
                      IISc Gymkhana Badminton Courts
                    </h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      Indian Institute of Science
                      <br />
                      Bangalore — 560012
                      <br />
                      India
                    </p>
                    <p className="text-muted-foreground text-sm mb-6">
                      Located within the IISc campus with easy access, ample
                      parking, and excellent connectivity.
                    </p>
                    <a
                      href="https://maps.app.goo.gl/pBTtJGYEPwnu6qd78"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-primary hover:bg-primary text-primary-foreground px-5 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 shadow-md shadow-primary/20"
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
                <div className="h-full rounded-3xl border border-border-strong shadow-md bg-muted overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-primary to-team" />
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/30 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <h2 className="text-2xl font-black text-foreground">
                        Membership & Access
                      </h2>
                    </div>

                    <div className="bg-primary/20 border border-primary/50 rounded-2xl p-5 mb-5">
                      <h3 className="font-black text-primary text-sm uppercase tracking-wider mb-2">
                        <span className="normal-case">IISc</span> Members
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
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
                          <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-soft text-sm">
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

        {/* Real-time Court Availability & Tournament Schedule (At the end of page) */}
        <CourtScheduleSection />
      </div>
    </section>
  );
}
