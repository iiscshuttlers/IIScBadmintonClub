import { Sparkles, ShieldCheck, Activity } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Medal,
  Trophy,
  Users,
  ChevronRight,
  Star,
  ExternalLink,
} from "lucide-react";
import iiscTeam from "@/assets/iisc-team.jpg";
import { usePageMeta } from "@/hooks/usePageMeta";
import { motion, type Variants } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { CountUpNumber } from "@/components/CountUpNumber";
import { ARCHIVED_TOURNAMENTS } from "@/data/tournamentArchive";
import { fetchSiteData } from "@/lib/siteData";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" },
  },
};
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};
const cardVariant: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

const VALUES = [
  {
    title: "Excellence",
    desc: "Striving for the highest standards in play and conduct.",
    icon: "⭐",
  },
  {
    title: "Inclusivity",
    desc: "Welcoming players of all backgrounds and skill levels.",
    icon: "🤝",
  },
  {
    title: "Integrity",
    desc: "Maintaining fair play and ethical conduct on and off court.",
    icon: "⚖️",
  },
  {
    title: "Community",
    desc: "Building lasting friendships across departments and batches.",
    icon: "🌱",
  },
];

// ── Derive the latest completed tournament for the highlight banner ───────────
function getLatestHighlight() {
  const completed = ARCHIVED_TOURNAMENTS.filter(
    (t) => t.status === "completed",
  );
  if (!completed.length) return null;
  // Sort newest first (use startDate string — ISO or year)
  const sorted = [...completed].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  );
  return sorted[0];
}

export default function Home() {
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("seenWhatsNew_v25")) {
      const timer = setTimeout(() => setShowWhatsNew(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  usePageMeta({
    title: "Home",
    description:
      "IISc Badminton Club — join a vibrant community of players, from beginners to champions, all united by passion for the sport.",
  });

  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    fetchSiteData("site_config", "site_config.json")
      .then((data) => {
        if (data) setConfig(data);
      })
      .catch(console.error);
  }, []);

  const [isImageOpen, setIsImageOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const teamMembers = [
    {
      role: "Convener",
      name: "Raja Janmejay",
      description: "Leading the club with vision and passion for the sport",
      image: `${import.meta.env.BASE_URL}convener.png`,
    },
    {
      role: "Co-Convener",
      name: "Aneesh Varla",
      description:
        "Helping members connect, compete, and grow through badminton",
      image: `${import.meta.env.BASE_URL}co_convener.png`,
    },
  ];

  // No longer redirect to /join — Home page should be the first impression for everyone

  const highlight = getLatestHighlight();

  return (
    <>
      {/* What's New Modal */}
      {showWhatsNew && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-indigo-100 dark:border-indigo-900/50 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Trophy className="w-32 h-32 text-indigo-500" />
            </div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl">
                <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                  What's New!
                </h2>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                  v2.5 Platform Update
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-8 relative z-10">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Overwatch Tribunal
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Suspicious matches are now flagged for admin review.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg shrink-0 mt-0.5">
                  <Activity className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Calibration Phase
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    New players are 'Unranked' for their first 5 matches.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowWhatsNew(false);
                localStorage.setItem("seenWhatsNew_v25", "true");
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-colors relative z-10"
            >
              Awesome, let's play!
            </button>
          </motion.div>
        </div>
      )}

      <div className="min-h-screen">
        {/* ── Hero Section ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden text-white min-h-[88vh] flex items-center">
          {/* Mobile: team photo background */}
          <div className="lg:hidden absolute inset-0 z-0">
            <img
              src={iiscTeam}
              alt="IISc Badminton Team"
              className="w-full h-full object-cover object-[25%_center]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-blue-950/90 via-blue-900/80 to-emerald-950/95" />
          </div>

          {/* Desktop: gradient */}
          <div className="hidden lg:block absolute inset-0 bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-950 z-0">
            <div className="absolute inset-0 hero-pattern" />
            {/* Decorative circles */}
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl" />
          </div>

          <div className="container mx-auto px-4 py-20 lg:py-24 relative z-10 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
              {/* Left Content */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="space-y-7"
              >
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-4 py-2 rounded-full text-sm font-semibold">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Welcome to Excellence
                </div>
                <h1
                  className="text-5xl lg:text-6xl xl:text-7xl font-black leading-tight"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  IISc
                  <br />
                  <span className="text-emerald-400">Badminton</span>
                  <br />
                  Club
                </h1>
                <p className="text-xl text-gray-300 leading-relaxed max-w-lg">
                  Experience the thrill of competitive badminton. Join our
                  vibrant community of players — from beginners to champions —
                  all united by passion for the sport.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <Link href="/events">
                    <Button className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-6 text-base font-bold flex items-center gap-2 w-full sm:w-auto justify-center rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-0.5">
                      Explore Events <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/players">
                    <Button
                      variant="outline"
                      className="border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 px-8 py-6 text-base font-semibold w-full sm:w-auto rounded-xl transition-all duration-300"
                    >
                      Meet the Players
                    </Button>
                  </Link>
                </div>
              </motion.div>

              {/* Right: Animated Logo (desktop only) */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="hidden lg:flex relative justify-center items-center"
              >
                <AnimatedLogo />
              </motion.div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/40 animate-bounce">
            <div className="w-5 h-8 rounded-full border-2 border-white/30 flex items-start justify-center pt-1.5">
              <div className="w-1 h-2 bg-white/50 rounded-full" />
            </div>
          </div>
        </section>

        {/* ── Quick Paths ──────────────────────────────────────────────────── */}
        <section className="py-20 bg-slate-50 dark:bg-slate-900">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-12"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
            >
              <h2
                className="text-3xl font-black text-blue-900 dark:text-white"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                What are you looking for?
              </h2>
              <p className="text-gray-500 dark:text-slate-400 mt-2">
                Quick access to everything the club offers
              </p>
            </motion.div>

            <motion.div
              className="grid md:grid-cols-3 gap-6"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
            >
              {[
                {
                  href: "/events",
                  title: "Events",
                  description:
                    "Browse live, upcoming and archived tournaments.",
                  icon: CalendarDays,
                  color: "bg-emerald-500",
                  lightColor: "bg-emerald-50 dark:bg-emerald-950/30",
                  textColor: "text-emerald-600",
                },
                {
                  href: "/winners",
                  title: "Winners Wall",
                  description:
                    "See champions and podiums from all club events.",
                  icon: Medal,
                  color: "bg-amber-500",
                  lightColor: "bg-amber-50 dark:bg-amber-950/30",
                  textColor: "text-amber-600",
                },
                {
                  href: "/announcements",
                  title: "Announcements",
                  description:
                    "Check court notices, event updates and club news.",
                  icon: Bell,
                  color: "bg-blue-600",
                  lightColor: "bg-blue-50 dark:bg-blue-950/30",
                  textColor: "text-blue-600",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div key={item.href} variants={cardVariant}>
                    <Link href={item.href}>
                      <div className="group h-full rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-7 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer">
                        <div
                          className={`w-13 h-13 w-14 h-14 rounded-2xl ${item.lightColor} flex items-center justify-center mb-5`}
                        >
                          <Icon className={`w-7 h-7 ${item.textColor}`} />
                        </div>
                        <h3 className="text-xl font-bold text-blue-900 dark:text-white mb-2">
                          {item.title}
                        </h3>
                        <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">
                          {item.description}
                        </p>
                        <div
                          className={`mt-5 inline-flex items-center gap-1.5 text-sm font-bold ${item.textColor} group-hover:gap-3 transition-all duration-300`}
                        >
                          Open <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ── About IISc Badminton Club / Mission & Values ─────────────── */}
        <section className="py-24 relative overflow-hidden bg-white dark:bg-slate-950">
          <div className="container mx-auto px-4 relative z-10 max-w-6xl">
            <motion.div
              className="mb-16 md:mb-20"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
            >
              <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                🏸 Our Story
              </div>
              <h2
                className="text-5xl lg:text-6xl font-black text-blue-900 dark:text-white mb-6 leading-tight"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                About IISc
                <br />
                <span className="text-emerald-500 dark:text-emerald-400">
                  Badminton Club
                </span>
              </h2>
              <p className="text-gray-600 dark:text-slate-300 max-w-2xl text-lg lg:text-xl leading-relaxed">
                A thriving community of 350+ badminton enthusiasts at the Indian
                Institute of Science — competing, connecting, and celebrating
                the sport year-round.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
            >
              {/* Mission */}
              <motion.div variants={fadeUp} className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full" />
                  <h3
                    className="text-3xl font-black text-blue-900 dark:text-white"
                    style={{ fontFamily: "Playfair Display, serif" }}
                  >
                    Our Mission
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-300 text-lg leading-relaxed whitespace-pre-wrap">
                  {config?.about?.mission ||
                    "To foster excellence in badminton through competitive play and community engagement at IISc. We aim to develop skilled players while promoting discipline, teamwork, and sportsmanship."}
                </p>
                {config?.about?.history && (
                  <>
                    <div className="flex items-center gap-3 pt-6">
                      <div className="w-2 h-8 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full" />
                      <h3
                        className="text-3xl font-black text-blue-900 dark:text-white"
                        style={{ fontFamily: "Playfair Display, serif" }}
                      >
                        Our History
                      </h3>
                    </div>
                    <p className="text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {config.about.history}
                    </p>
                  </>
                )}
              </motion.div>

              {/* Values grid */}
              <motion.div variants={fadeUp}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-8 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full" />
                  <h3
                    className="text-3xl font-black text-blue-900 dark:text-white"
                    style={{ fontFamily: "Playfair Display, serif" }}
                  >
                    Our Values
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {VALUES.map((v) => (
                    <div
                      key={v.title}
                      className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="text-2xl mb-3">{v.icon}</div>
                      <h4 className="font-black text-blue-900 dark:text-white text-sm mb-1">
                        {v.title}
                      </h4>
                      <p className="text-gray-500 dark:text-slate-400 text-xs leading-relaxed">
                        {v.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Team Photo incorporated into Our Story */}
            <motion.div
              className="mt-16 relative rounded-3xl overflow-hidden shadow-2xl cursor-pointer group max-w-5xl mx-auto border-4 border-white dark:border-slate-800"
              variants={fadeUp}
              onClick={() => setIsImageOpen(true)}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-blue-950/80 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-8">
                <span className="text-white font-semibold text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                  Click to enlarge
                </span>
              </div>
              <img
                src={iiscTeam}
                alt="IISc Badminton Team"
                loading="lazy"
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700"
              />
            </motion.div>
          </div>
        </section>

        {/* ── Club Leadership ───────────────────────────────────────────────── */}
        <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-12"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-2 h-8 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
                <h2
                  className="text-3xl font-black text-blue-900 dark:text-white"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  Club Leadership
                </h2>
              </div>
              <p className="text-gray-500 dark:text-slate-400">
                The people keeping the shuttles flying
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {teamMembers.map((member, idx) => {
                const avatarColors = [
                  "from-emerald-500 to-teal-600",
                  "from-blue-600 to-indigo-700",
                ];
                const initials = member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const colorClass = avatarColors[idx % avatarColors.length];
                return (
                  <motion.div
                    key={idx}
                    variants={fadeUp}
                    className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-6 p-7 sm:p-8 rounded-3xl border-2 border-emerald-100 dark:border-emerald-900/50 bg-white dark:bg-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                    onClick={() =>
                      member.image && !imageErrors[member.name]
                        ? setSelectedImage(member.image)
                        : undefined
                    }
                  >
                    <div
                      className={`flex-shrink-0 w-28 h-28 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-lg overflow-hidden border-4 border-white dark:border-slate-700 relative group-hover:scale-105 transition-transform duration-300`}
                    >
                      {member.image && !imageErrors[member.name] ? (
                        <>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors z-10 flex items-center justify-center pointer-events-none">
                            <Star className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                          </div>
                          <img
                            loading="lazy"
                            src={member.image}
                            alt={member.name}
                            className="w-full h-full object-cover"
                            onError={() =>
                              setImageErrors((prev) => ({
                                ...prev,
                                [member.name]: true,
                              }))
                            }
                          />
                        </>
                      ) : (
                        <span className="text-white text-4xl font-black">
                          {initials}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="inline-block text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">
                        {member.role}
                      </span>
                      <h3 className="text-xl font-black text-blue-900 dark:text-white leading-tight">
                        {member.name}
                      </h3>
                      <p className="text-gray-500 dark:text-slate-400 text-sm mt-1 leading-relaxed">
                        {member.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ── Club at a Glance ─────────────────────────────────────────── */}
        <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 border-t border-slate-200 dark:border-slate-800">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-12"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-2 h-8 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
                <h2
                  className="text-3xl font-black text-blue-900 dark:text-white"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  Club at a Glance
                </h2>
              </div>
              <p className="text-gray-500 dark:text-slate-400 mt-2">
                A thriving community of badminton enthusiasts at IISc.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {[
                {
                  icon: "👥",
                  label: "Members",
                  value: config?.stats?.members || "350+",
                  desc: "Active players across all skill levels",
                  color: "from-emerald-500 to-teal-600",
                },
                {
                  icon: "🏆",
                  label: "Tournaments",
                  value: config?.stats?.tournaments || "20+",
                  desc: "Organized competitive events since inception",
                  color: "from-amber-500 to-orange-500",
                },
                {
                  icon: "🏅",
                  label: "IISM Trophies",
                  value: config?.stats?.trophies || "10+",
                  desc: "Medals brought home from the national stage",
                  color: "from-blue-600 to-indigo-600",
                },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  variants={fadeUp}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-7 shadow-md border border-slate-100 dark:border-slate-700 text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div
                    className={`inline-flex p-4 bg-gradient-to-br ${item.color} rounded-2xl mb-4 shadow-md`}
                  >
                    <span className="text-2xl">{item.icon}</span>
                  </div>
                  <div className="text-4xl font-black text-blue-900 dark:text-white mb-1">
                    {item.value}
                  </div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                    {item.label}
                  </div>
                  <p className="text-gray-500 dark:text-slate-400 text-xs leading-relaxed">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Recent Achievement Highlight ─────────────────────────────────── */}
        {highlight && (
          <motion.section
            className="py-16 bg-white dark:bg-slate-900"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            <div className="container mx-auto px-4">
              <div className="flex flex-col md:flex-row items-center gap-8 bg-gradient-to-r from-blue-900 to-emerald-900 rounded-3xl p-8 md:p-12 text-white shadow-xl overflow-hidden relative">
                <div className="absolute inset-0 hero-pattern opacity-50" />
                <div className="relative z-10 flex-1 space-y-3">
                  <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    <Star className="w-3 h-3" />
                    Recent Highlight
                  </div>
                  <h3
                    className="text-2xl md:text-3xl font-black"
                    style={{ fontFamily: "Playfair Display, serif" }}
                  >
                    {highlight.name}
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed max-w-xl">
                    {highlight.description}
                  </p>
                </div>
                <div className="relative z-10 flex gap-3 flex-wrap justify-center md:justify-end">
                  <Link href={`/events/${highlight.slug}`}>
                    <Button className="bg-white text-blue-900 hover:bg-gray-100 font-bold px-6 py-3 rounded-xl flex items-center gap-2">
                      View Results <Trophy className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href="/winners">
                    <Button
                      variant="outline"
                      className="border-white/30 text-white hover:bg-white/10 font-semibold px-6 py-3 rounded-xl"
                    >
                      Winners Wall
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── CTA Section ──────────────────────────────────────────────────── */}
        <motion.section
          className="py-20 bg-blue-900 dark:bg-blue-950 text-white"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-2xl mx-auto space-y-6">
              <h2
                className="text-4xl font-black"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                Ready to Play?
              </h2>
              <p className="text-lg text-gray-300">
                Whether you're a seasoned player or just starting out, there's a
                court and a community waiting for you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <Link href="/contact">
                  <Button className="bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-6 text-base font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all duration-300">
                    Get Started Today
                  </Button>
                </Link>
                <Link href="/players">
                  <Button
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 px-10 py-6 text-base font-semibold rounded-xl transition-all duration-300"
                  >
                    Meet the Players
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Leadership Photo Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <button
              className="absolute top-6 right-6 z-[60] text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(null);
              }}
            >
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div
              className="w-full h-full flex items-center justify-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                centerOnInit
              >
                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "100%" }}
                  contentStyle={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    loading="lazy"
                    src={selectedImage}
                    alt="Leadership"
                    className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
                  />
                </TransformComponent>
              </TransformWrapper>
            </div>
          </div>
        )}

        {/* Fullscreen Image Modal */}
        {isImageOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
            onClick={() => setIsImageOpen(false)}
          >
            <button
              className="absolute top-6 right-6 z-[60] text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                setIsImageOpen(false);
              }}
            >
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div
              className="w-full h-full flex items-center justify-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                centerOnInit
              >
                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "100%" }}
                  contentStyle={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    loading="lazy"
                    src={iiscTeam}
                    alt="IISc Badminton Team Full"
                    className="max-w-full max-h-full rounded-xl object-contain shadow-2xl"
                  />
                </TransformComponent>
              </TransformWrapper>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Animated Logo Component ──────────────────────────────────────────────────
function AnimatedLogo() {
  return (
    <div className="relative flex items-center justify-center bg-transparent overflow-visible">
      <div
        className="relative flex-shrink-0"
        style={{ width: "min(380px, 85vw)", height: "min(380px, 85vw)" }}
      >
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-blue-950 to-slate-900 shadow-2xl border-[8px] border-slate-950 flex flex-col items-center justify-center overflow-hidden ring-[6px] ring-amber-500 z-0">
          {/* Grid */}
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* IISc Silhouette */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] opacity-20 text-amber-500 pointer-events-none mt-2 z-0">
            <svg
              viewBox="0 0 200 200"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            >
              <line x1="15" y1="180" x2="185" y2="180" strokeWidth="3" />
              <rect x="75" y="80" width="50" height="100" />
              <circle cx="100" cy="105" r="9" />
              <polyline points="100,100 100,105 104,105" />
              <rect x="25" y="130" width="50" height="50" />
              <path d="M 35 180 L 35 150 Q 40 142 45 150 L 45 180" />
              <path d="M 55 180 L 55 150 Q 60 142 65 150 L 65 180" />
              <rect x="125" y="130" width="50" height="50" />
              <path d="M 135 180 L 135 150 Q 140 142 145 150 L 145 180" />
              <path d="M 155 180 L 155 150 Q 160 142 165 150 L 165 180" />
              <polygon
                points="70,80 130,80 125,70 75,70"
                fill="currentColor"
                fillOpacity="0.15"
              />
              <rect x="82" y="45" width="36" height="25" />
              <line x1="94" y1="45" x2="94" y2="70" />
              <line x1="106" y1="45" x2="106" y2="70" />
              <polygon
                points="78,45 122,45 118,38 82,38"
                fill="currentColor"
                fillOpacity="0.15"
              />
              <path
                d="M 82 38 C 82 10, 118 10, 118 38 Z"
                fill="currentColor"
                fillOpacity="0.1"
              />
              <line x1="100" y1="18" x2="100" y2="0" strokeWidth="2" />
              <circle cx="100" cy="0" r="2" fill="currentColor" />
            </svg>
          </div>

          {/* Top Text: IISc */}
          <div className="absolute top-16 left-0 right-0 text-center z-10 flex flex-col items-center">
            <h1 className="text-7xl font-black text-white tracking-wider drop-shadow-md flex items-baseline">
              IIS<span className="text-6xl text-amber-400 ml-0.5">c</span>
            </h1>
          </div>

          {/* Central Animations */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="racket-anim absolute top-1/2 left-1/2 -ml-[50px] -mt-[50px] w-[100px] h-[180px]">
              <svg width="100" height="180" viewBox="0 0 100 180">
                <rect
                  x="42"
                  y="120"
                  width="16"
                  height="50"
                  fill="#f59e0b"
                  rx="2"
                />
                <rect
                  x="42"
                  y="165"
                  width="16"
                  height="5"
                  fill="#b45309"
                  rx="1"
                />
                <rect x="44" y="115" width="12" height="5" fill="#94a3b8" />
                <line
                  x1="50"
                  y1="115"
                  x2="50"
                  y2="75"
                  stroke="#cbd5e1"
                  strokeWidth="6"
                />
                <path d="M 50 75 L 40 60 L 60 60 Z" fill="#3b82f6" />
                <defs>
                  <pattern
                    id="strings"
                    width="8"
                    height="8"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect
                      width="8"
                      height="8"
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="0.75"
                    />
                  </pattern>
                </defs>
                <ellipse
                  cx="50"
                  cy="50"
                  rx="28"
                  ry="38"
                  fill="url(#strings)"
                  stroke="#3b82f6"
                  strokeWidth="6"
                />
              </svg>
            </div>
            <div className="shuttle-anim absolute top-1/2 left-1/2 -ml-[30px] -mt-[30px] w-[60px] h-[60px]">
              <svg width="60" height="60" viewBox="0 0 60 60">
                <path d="M 22 45 A 8 8 0 0 0 38 45 Z" fill="#ef4444" />
                <rect x="22" y="42" width="16" height="3" fill="#ffffff" />
                <path
                  d="M 22 42 L 10 10 L 50 10 L 38 42 Z"
                  fill="#f8fafc"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <line
                  x1="26"
                  y1="42"
                  x2="20"
                  y2="10"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
                <line
                  x1="30"
                  y1="42"
                  x2="30"
                  y2="10"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
                <line
                  x1="34"
                  y1="42"
                  x2="40"
                  y2="10"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
                <path
                  d="M 12 25 Q 30 32 48 25"
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
                <path
                  d="M 17 35 Q 30 39 43 35"
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            <div className="spark-anim absolute top-1/2 left-1/2 ml-[10px] mt-[10px] w-[60px] h-[60px] -translate-x-1/2 -translate-y-1/2">
              <svg viewBox="0 0 100 100">
                <path
                  d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z"
                  fill="#fef08a"
                />
              </svg>
            </div>
          </div>

          {/* Bottom Text */}
          <div className="absolute bottom-14 left-0 right-0 text-center z-10 flex flex-col items-center">
            <h2 className="text-2xl font-bold text-amber-500 tracking-[0.25em] uppercase drop-shadow-sm">
              Badminton
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-8 h-[2px] bg-white/40"></div>
              <h3 className="text-lg font-semibold text-slate-100 tracking-[0.4em] uppercase">
                Club
              </h3>
              <div className="w-8 h-[2px] bg-white/40"></div>
            </div>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .racket-anim {
          transform-origin: 50px 170px;
          animation: swing 1.5s infinite ease-in-out;
        }
        @keyframes swing {
          0%, 100% { transform: rotate(-15deg); }
          35% { transform: rotate(-50deg); }
          47% { transform: rotate(-50deg); }
          50% { transform: rotate(20deg); }
          58% { transform: rotate(55deg); }
          75% { transform: rotate(-15deg); }
        }
        .shuttle-anim {
          transform-origin: 30px 30px;
          animation: fly 1.5s infinite linear;
        }
        @keyframes fly {
          0% { transform: translate(-180px, -120px) rotate(135deg); opacity: 0; }
          10% { opacity: 1; }
          47% { transform: translate(25px, -5px) rotate(135deg); }
          50% { transform: translate(40px, 10px) rotate(45deg) scale(0.6, 0.9); }
          52% { transform: translate(55px, -5px) rotate(45deg) scale(1, 1); }
          80% { transform: translate(200px, -150px) rotate(45deg); opacity: 1; }
          90% { transform: translate(250px, -200px) rotate(45deg); opacity: 0; }
          100% { transform: translate(250px, -200px) rotate(45deg); opacity: 0; }
        }
        .spark-anim {
          transform-origin: center;
          animation: spark 1.5s infinite;
        }
        @keyframes spark {
          0%, 48% { opacity: 0; transform: scale(0) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(45deg); }
          54% { opacity: 0; transform: scale(1.8) rotate(90deg); }
          100% { opacity: 0; }
        }
      `,
        }}
      />
    </div>
  );
}
