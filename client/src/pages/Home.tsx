import { Sparkles, ShieldCheck, Activity, Award, Target, Handshake, Sprout } from "lucide-react";
import { Link } from "wouter";
import { Capacitor } from "@capacitor/core";
import { Geofence } from "@/lib/geofence";
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
  Zap,
  MapPin,
  Map,
} from "lucide-react";
import iiscTeam from "@/assets/iisc-team.jpg";
import { usePageMeta } from "@/hooks/usePageMeta";
import { motion, type Variants } from "framer-motion";
import { useState, useEffect } from "react";
import { ARCHIVED_TOURNAMENTS } from "@/data/tournamentArchive";
import { fetchSiteData } from "@/lib/siteData";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { InfoModal } from "@/components/InfoModal";
import type { ConvenerData } from "@/components/admin/ConvenerEditor";
import { VenueTrafficWidget } from "@/components/home/VenueTrafficWidget";

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const cardVariant: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const VALUES = [
  { title: "Excellence", desc: "Striving for the highest standards in play and conduct.", Icon: Award },
  { title: "Inclusivity", desc: "Welcoming players of all backgrounds and skill levels.", Icon: Handshake },
  { title: "Integrity", desc: "Maintaining fair play and ethical conduct on and off court.", Icon: Target },
  { title: "Community", desc: "Building lasting friendships across departments and batches.", Icon: Sprout },
];

function getLatestHighlight() {
  const completed = ARCHIVED_TOURNAMENTS.filter((t) => t.status === "completed");
  if (!completed.length) return null;
  return [...completed].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

export default function Home() {
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [convenerData, setConvenerData] = useState<ConvenerData | null>(null);

  useEffect(() => {
    fetchSiteData("site_config", "site_config.json")
      .then((data) => {
        if (data) setConfig(data);
      })
      .catch(console.error);

    fetchSiteData<ConvenerData>("convener_photos", "convener_photos.json")
      .then((data) => { if (data) setConvenerData(data); })
      .catch(() => {}); // silent – static files may not exist yet
  }, []);

  usePageMeta({
    title: "Home",
    description:
      "IISc Badminton Club — join a vibrant community of players, from beginners to champions, all united by passion for the sport.",
  });

  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const agreed = localStorage.getItem("location_disclosure_agreed");
      if (agreed === "true") {
        Geofence.setupGymkhanaGeofence().catch(e => console.log("Geofence setup failed:", e));
      } else if (!agreed) {
        setShowLocationDisclosure(true);
      }
    }
  }, []);

  const handleAgreeLocation = () => {
    localStorage.setItem("location_disclosure_agreed", "true");
    setShowLocationDisclosure(false);
    Geofence.setupGymkhanaGeofence().catch(e => console.log("Geofence setup failed:", e));
  };

  const handleDeclineLocation = () => {
    localStorage.setItem("location_disclosure_agreed", "false");
    setShowLocationDisclosure(false);
  };

  const [isImageOpen, setIsImageOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const teamMembers = [
    {
      role: "Convener",
      name: convenerData?.convener?.name || "Raja Janmejay",
      description: convenerData?.convener?.description || "Leading the club with vision and passion for the sport",
      image: convenerData?.convener?.imageUrl || `${import.meta.env.BASE_URL}convener.png`,
    },
    {
      role: "Co-Convener",
      name: convenerData?.coConvener?.name || "Aneesh Varla",
      description: convenerData?.coConvener?.description || "Helping members connect, compete, and grow through badminton",
      image: convenerData?.coConvener?.imageUrl || `${import.meta.env.BASE_URL}co_convener.png`,
    },
  ];

  const highlight = getLatestHighlight();

  return (
    <>
      <div className="min-h-screen pb-24 lg:pb-8">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section aria-label="Hero" className="relative overflow-hidden text-white py-10 lg:py-12 flex items-center bg-slate-950">
          {/* Mobile photo bg */}
          <div className="lg:hidden absolute inset-x-0 top-0 z-0">
            <img src={iiscTeam} alt="IISc Badminton Team" className="w-full aspect-[4/3] sm:aspect-video object-cover object-top" />
            <div className="absolute inset-0 bg-slate-950/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          </div>

          {/* Desktop bg */}
          <div className="hidden lg:block absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950" />
            <div className="absolute inset-0 hero-pattern opacity-30" />
            {/* decorative glow orbs */}
            <div className="absolute top-1/4 right-[15%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/3 left-[10%] w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[80px]" />
            <div className="absolute top-1/3 left-[40%] w-[300px] h-[300px] bg-primary/5 rounded-full blur-[60px]" />
            {/* dot grid */}
            <div className="absolute inset-0 dot-pattern opacity-30" />
          </div>

          <div className="container mx-auto px-4 pt-56 sm:pt-72 pb-4 lg:pt-8 lg:pb-6 relative z-10 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">

              {/* Left Content */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-2">
                {/* Live badge */}
                <div className="inline-flex items-center gap-2.5 bg-white/8 border border-white/15 backdrop-blur-sm text-primary/70 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  Welcome to IISc Badminton Club
                </div>

                {/* Heading */}
                <div className="space-y-2">
                  <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]" style={{ fontFamily: "Playfair Display, serif" }}>
                    Where{" "}
                    <span className="relative inline-block">
                      <span className="text-primary drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">Champions</span>
                    </span>{" "}
                    Are Forged
                  </h1>
                  <p className="text-base text-slate-200 font-bold uppercase tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    Indian Institute of Science · Bangalore
                  </p>
                </div>

                <p className="text-lg text-white font-medium leading-relaxed max-w-lg drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                  Experience world-class badminton at IISc. Join our vibrant community of{" "}
                  <span className="text-white font-black bg-primary/40 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-primary/50 shadow-sm">350+ players</span> — from beginners to national champions — competing, training, and growing together.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 pt-0">
                  <Link href="/pulse#events">
                    <Button className="bg-primary hover:bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold flex items-center gap-1.5 w-full sm:w-auto justify-center rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all duration-300 glow-emerald cursor-pointer">
                      Explore Events <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>

                {/* Inline mini-stats */}
                <div className="flex items-center justify-center gap-4 pt-1 border-t border-white/10 max-w-lg">
                  {[
                    { value: config?.stats?.members || "350+", label: "Members" },
                    { value: config?.stats?.tournaments || "20+", label: "Tournaments" },
                    { value: config?.stats?.trophies || "10+", label: "IISM Trophies" },
                  ].map(({ value, label }) => (
                    <div key={label} className="text-center">
                      <div className="text-2xl font-black text-white drop-shadow-sm">{value}</div>
                      <div className="text-[10px] text-white/85 font-semibold uppercase tracking-wider drop-shadow-sm">{label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Right: Animated Logo */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.15 }}
                className="hidden lg:flex justify-center items-center"
              >
                <AnimatedLogo />
              </motion.div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/30 animate-bounce">
            <div className="w-5 h-8 rounded-full border-2 border-white/20 flex items-start justify-center pt-1.5">
              <div className="w-1 h-2 bg-white/40 rounded-full" />
            </div>
          </div>
        </section>

        <VenueTrafficWidget />

        {/* ── QUICK PATHS ──────────────────────────────────────────────── */}
        <section aria-label="Quick Links" className="py-12 bg-slate-50 dark:bg-slate-900/60">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-12"
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            >
              <p className="text-xs font-bold text-primary dark:text-primary uppercase tracking-widest mb-3">Quick Access</p>
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-3xl lg:text-4xl font-black text-foreground dark:text-foreground" style={{ fontFamily: "Playfair Display, serif" }}>
                  What are you looking for?
                </h2>
                <InfoModal
                  title="QUICK LINKS"
                  items={[
                    { badge: "NAVIGATE", title: "Core Features", desc: "These are the most commonly accessed pages in the platform." }
                  ]}
                />
              </div>
              <p className="text-muted-foreground dark:text-muted-foreground mt-2 text-sm">Everything the club offers, one click away</p>
            </motion.div>

            <motion.div
              className="grid md:grid-cols-3 gap-5"
              variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            >
              {[
                {
                  href: "/pulse#events", title: "Pulse", description: "Browse live feeds, upcoming and archived tournaments.",
                  Icon: CalendarDays,
                  iconBg: "bg-primary/15 dark:bg-primary/40",
                  iconColor: "text-primary dark:text-primary",
                  accentColor: "text-primary dark:text-primary",
                  hoverBorder: "hover:border-primary/40 dark:hover:border-primary",
                  tag: "Live Now",
                  tagColor: "bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary",
                },
                {
                  href: "/legacy", title: "Legacy", description: "See champions, podiums, and photo memories from all club events.",
                  Icon: Medal,
                  iconBg: "bg-amber-100 dark:bg-amber-900/40",
                  iconColor: "text-amber-600 dark:text-amber-400",
                  accentColor: "text-amber-600 dark:text-amber-400",
                  hoverBorder: "hover:border-amber-200 dark:hover:border-amber-800",
                  tag: "Legacy",
                  tagColor: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
                },
                {
                  href: "/pulse", title: "Announcements", description: "Check court notices, event updates and club news.",
                  Icon: Bell,
                  iconBg: "bg-blue-100 dark:bg-blue-900/40",
                  iconColor: "text-blue-600 dark:text-blue-400",
                  accentColor: "text-blue-600 dark:text-blue-400",
                  hoverBorder: "hover:border-blue-200 dark:hover:border-blue-800",
                  tag: "Updates",
                  tagColor: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
                },
              ].map((item) => (
                <motion.div key={item.href} variants={cardVariant}>
                  <Link href={item.href}>
                    <div className={`group h-full rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer ${item.hoverBorder}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-2xl ${item.iconBg} flex items-center justify-center`}>
                          <item.Icon className={`w-5 h-5 ${item.iconColor}`} />
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${item.tagColor}`}>
                          {item.tag}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-foreground dark:text-foreground mb-1">{item.title}</h3>
                      <p className="text-muted-foreground dark:text-muted-foreground text-sm leading-snug mb-3">{item.description}</p>
                      <div className={`inline-flex items-center gap-1.5 text-sm font-bold ${item.accentColor} group-hover:gap-2.5 transition-all duration-300`}>
                        Open <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── STATS BANNER (dark) ───────────────────────────────────────── */}
        <section aria-label="Club Statistics" className="py-6 bg-slate-900 dark:bg-slate-950 border-y border-slate-800">
          <div className="container mx-auto px-4">
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-slate-700/40 rounded-2xl overflow-hidden"
              variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
            >
              {[
                { Icon: Users, value: config?.stats?.members || "350+", label: "Active Members", desc: "Across all skill levels", gradient: "from-primary to-teal-500" },
                { Icon: Trophy, value: config?.stats?.tournaments || "20+", label: "Tournaments Held", desc: "Competitive events organized", gradient: "from-amber-500 to-orange-500" },
                { Icon: Medal, value: config?.stats?.trophies || "10+", label: "IISM Trophies", desc: "National stage medals", gradient: "from-blue-500 to-indigo-500" },
              ].map(({ Icon, value, label, desc, gradient }) => (
                <motion.div
                  key={label}
                  variants={cardVariant}
                  className="bg-slate-900 dark:bg-slate-950 p-6 text-center relative overflow-hidden group"
                >
                  <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${gradient}`} />
                  <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${gradient} bg-opacity-10 mb-2`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-4xl lg:text-5xl font-black text-white mb-1 tabular-nums">{value}</div>
                  <div className="text-sm font-bold text-slate-300 mb-1">{label}</div>
                  <div className="text-xs text-slate-400">{desc}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── ABOUT / MISSION & VALUES ──────────────────────────────────── */}
        <section aria-label="About & Mission" className="py-8 bg-white dark:bg-slate-950">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              className="mb-6"
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            >
              <div className="inline-flex items-center gap-2 bg-primary/10 dark:bg-primary/10 border border-primary/40 dark:border-primary/25 text-primary dark:text-primary px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
                <Zap className="w-3.5 h-3.5" /> Our Story
              </div>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground dark:text-foreground mb-2 leading-tight" style={{ fontFamily: "Playfair Display, serif" }}>
                About IISc
                <span className="text-primary dark:text-primary"> Badminton Club</span>
              </h2>
              <p className="text-muted-foreground dark:text-slate-300 max-w-2xl text-lg leading-relaxed">
                A thriving community of 350+ badminton enthusiasts at the Indian Institute of Science — competing, connecting, and celebrating the sport year-round.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start"
              variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            >
              {/* Mission */}
              <motion.div variants={fadeUp} className="space-y-4">
                <div>
                  <h3 className="text-2xl font-black text-foreground dark:text-foreground mb-1 flex items-center gap-3" style={{ fontFamily: "Playfair Display, serif" }}>
                    <span className="w-1.5 h-7 bg-gradient-to-b from-primary to-teal-500 rounded-full inline-block" />
                    Our Mission
                  </h3>
                </div>
                <p className="text-muted-foreground dark:text-slate-300 leading-relaxed text-base whitespace-pre-wrap">
                  {config?.about?.mission ||
                    "To foster excellence in badminton through competitive play and community engagement at IISc. We aim to develop skilled players while promoting discipline, teamwork, and sportsmanship."}
                </p>
                {config?.about?.history && (
                  <div className="pt-2 space-y-2">
                    <h3 className="text-2xl font-black text-foreground dark:text-foreground flex items-center gap-3" style={{ fontFamily: "Playfair Display, serif" }}>
                      <span className="w-1.5 h-7 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full inline-block" />
                      Our History
                    </h3>
                    <p className="text-muted-foreground dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{config.about.history}</p>
                  </div>
                )}
              </motion.div>

              {/* Values */}
              <motion.div variants={fadeUp}>
                <h3 className="text-2xl font-black text-foreground dark:text-foreground mb-4 flex items-center gap-3" style={{ fontFamily: "Playfair Display, serif" }}>
                  <span className="w-1.5 h-7 bg-gradient-to-b from-orange-400 to-amber-500 rounded-full inline-block" />
                  Our Values
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {VALUES.map(({ title, desc, Icon }) => (
                    <div
                      key={title}
                      className="group relative rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                    >
                      <div className="w-8 h-8 rounded-xl bg-primary/15 dark:bg-primary/40 flex items-center justify-center mb-2">
                        <Icon className="w-4 h-4 text-primary dark:text-primary" />
                      </div>
                      <h4 className="font-black text-foreground dark:text-foreground text-sm mb-1">{title}</h4>
                      <p className="text-muted-foreground dark:text-muted-foreground text-xs leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Team Photo */}
            <motion.div
              className="mt-8 relative rounded-3xl overflow-hidden shadow-2xl cursor-pointer group border border-slate-200 dark:border-slate-700 max-w-5xl mx-auto"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              onClick={() => setIsImageOpen(true)}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent z-10 flex items-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-foreground text-sm font-semibold bg-white/15 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                  Click to enlarge photo
                </span>
              </div>
              <img
                src={iiscTeam}
                alt="IISc Badminton Team"
                loading="lazy"
                width={800}
                height={600}
                className="w-full aspect-[4/3] object-cover group-hover:scale-[1.03] transition-transform duration-700"
              />
            </motion.div>
          </div>
        </section>

        {/* ── LEADERSHIP ────────────────────────────────────────────────── */}
        <section aria-label="Leadership Team" className="py-12 bg-slate-50 dark:bg-slate-900/50">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-12"
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            >
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Leadership</p>
              <h2 className="text-3xl font-black text-foreground dark:text-foreground" style={{ fontFamily: "Playfair Display, serif" }}>
                Club Leadership
              </h2>
              <p className="text-muted-foreground dark:text-muted-foreground text-sm mt-2">The people keeping the shuttles flying</p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto"
              variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
            >
              {teamMembers.map((member, idx) => {
                const gradients = ["from-primary to-teal-600", "from-blue-600 to-indigo-700"];
                const initials = member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <motion.div
                    key={idx}
                    variants={cardVariant}
                    className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-6 p-7 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                    onClick={() => member.image && !imageErrors[member.name] ? setSelectedImage(member.image) : undefined}
                  >
                    <div className={`flex-shrink-0 w-24 h-24 rounded-full bg-gradient-to-br ${gradients[idx % 2]} flex items-center justify-center shadow-lg overflow-hidden ring-4 ring-white dark:ring-slate-800 group-hover:scale-105 transition-transform duration-300`}>
                      {member.image && !imageErrors[member.name] ? (
                        <img
                          loading="lazy"
                          src={member.image}
                          alt={member.name}
                          className="w-full h-full object-cover"
                          onError={() => setImageErrors((prev) => ({ ...prev, [member.name]: true }))}
                        />
                      ) : (
                        <span className="text-foreground text-3xl font-black">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="inline-block text-[10px] font-black text-primary dark:text-primary uppercase tracking-widest mb-1.5 px-2.5 py-1 bg-primary/10 dark:bg-primary/40 rounded-full">
                        {member.role}
                      </span>
                      <h3 className="text-xl font-black text-foreground dark:text-foreground leading-tight">{member.name}</h3>
                      <p className="text-muted-foreground dark:text-muted-foreground text-sm mt-1.5 leading-relaxed">{member.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ── RECENT HIGHLIGHT ──────────────────────────────────────────── */}
        {highlight && (
          <motion.section
            className="py-8 bg-white dark:bg-slate-900"
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
          >
            <div className="container mx-auto px-4">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-emerald-700 to-lime-600 p-6 md:p-8 shadow-2xl">
                {/* Decorative elements */}
                <div className="absolute inset-0 hero-pattern opacity-40" />
                <div className="absolute top-0 right-0 w-80 h-80 bg-lime-400/8 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/8 rounded-full blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-teal-400 to-orange-500" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="inline-flex items-center gap-2 bg-amber-400/15 border border-amber-400/25 text-amber-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      <Star className="w-3 h-3" /> Recent Highlight
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Playfair Display, serif" }}>
                      {highlight.name}
                    </h3>
                    <p className="text-emerald-50 text-sm leading-relaxed max-w-xl">{highlight.description}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/events/${highlight.slug}`}>
                      <Button className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-lg transition-all hover:-translate-y-0.5">
                        View Results <Trophy className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href="/legacy">
                      <Button variant="outline" className="border-white/40 text-white hover:bg-white/10 font-semibold px-5 py-2.5 rounded-xl cursor-pointer transition-all">
                        Legacy
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="py-6 relative overflow-hidden bg-slate-900 dark:bg-slate-950">
          {/* Background */}
          <div className="absolute inset-0 hero-pattern opacity-50" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/6 rounded-full blur-[100px]" />

          <motion.div
            className="container mx-auto px-4 text-center relative z-10"
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
          >
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/8 border border-white/12 text-primary px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5" /> Join the Community
              </div>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-tight" style={{ fontFamily: "Playfair Display, serif" }}>
                Ready to Pick Up<br />
                <span className="text-primary">the Racket?</span>
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Whether you're a seasoned player or just starting out, there's a court and a community waiting for you at IISc.
              </p>
              <div className="flex flex-col sm:flex-row gap-3.5 justify-center pt-2">
                <Link href="/join">
                  <Button className="bg-primary hover:bg-primary text-primary-foreground px-8 py-3.5 text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all duration-300 glow-emerald cursor-pointer">
                    Get Started Today
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── MODALS ────────────────────────────────────────────────────── */}
        {selectedImage && (
          <ImageModal src={selectedImage} alt="Leadership" onClose={() => setSelectedImage(null)} />
        )}
        {isImageOpen && (
          <ImageModal src={iiscTeam} alt="IISc Badminton Team" onClose={() => setIsImageOpen(false)} />
        )}

      {showLocationDisclosure && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <button
              className="absolute top-4 right-4 z-10 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full p-1.5 transition-all cursor-pointer"
              onClick={handleDeclineLocation}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-6 mt-2">
              <MapPin className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white mb-3">Use your location</h2>
            <p className="text-sm font-medium text-slate-300 leading-relaxed mb-6">
              This app collects location data to enable automatic check-ins and notifications when you arrive at the badminton courts, even when the app is closed or not in use.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAgreeLocation}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition-colors"
              >
                I Agree
              </button>
              <button
                onClick={handleDeclineLocation}
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors"
              >
                No Thanks
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

/* ── Image modal helper ─────────────────────────────────────────────────────── */
function ImageModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute top-5 right-5 z-[60] text-foreground/60 hover:text-foreground bg-white/10 hover:bg-white/20 rounded-full p-2.5 transition-all cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="w-full h-full flex items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit>
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <img loading="lazy" src={src} alt={alt} className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl" />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}

// ── Animated Logo ─────────────────────────────────────────────────────────────
function AnimatedLogo() {
  return (
    <div className="relative flex items-center justify-center overflow-visible">
      <div className="relative flex-shrink-0" style={{ width: "min(260px, 75vw)", height: "min(260px, 75vw)" }}>
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-slate-950 to-blue-950 shadow-2xl border-[8px] border-slate-900 flex flex-col items-center justify-center overflow-hidden ring-[6px] ring-amber-500">
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f59e0b" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* IISc silhouette */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] opacity-20 text-amber-500 pointer-events-none mt-2">
            <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
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
              <polygon points="70,80 130,80 125,70 75,70" fill="currentColor" fillOpacity="0.15" />
              <rect x="82" y="45" width="36" height="25" />
              <line x1="94" y1="45" x2="94" y2="70" />
              <line x1="106" y1="45" x2="106" y2="70" />
              <polygon points="78,45 122,45 118,38 82,38" fill="currentColor" fillOpacity="0.15" />
              <path d="M 82 38 C 82 10, 118 10, 118 38 Z" fill="currentColor" fillOpacity="0.1" />
              <line x1="100" y1="18" x2="100" y2="0" strokeWidth="2" />
              <circle cx="100" cy="0" r="2" fill="currentColor" />
            </svg>
          </div>

          {/* Top text */}
          <div className="absolute top-10 left-0 right-0 text-center z-10 flex flex-col items-center">
            <h1 className="text-7xl font-black text-foreground tracking-wider drop-shadow-md flex items-baseline">
              IIS<span className="text-6xl text-amber-400 ml-0.5">c</span>
            </h1>
          </div>

          {/* Central animations */}
          <div className="absolute inset-0 z-20 pointer-events-none transform scale-75 origin-center">
            <div className="racket-anim absolute top-1/2 left-1/2 -ml-[50px] -mt-[50px] w-[100px] h-[180px]">
              <svg width="100" height="180" viewBox="0 0 100 180">
                <rect x="42" y="120" width="16" height="50" fill="#f59e0b" rx="2" />
                <rect x="42" y="165" width="16" height="5" fill="#b45309" rx="1" />
                <rect x="44" y="115" width="12" height="5" fill="#94a3b8" />
                <line x1="50" y1="115" x2="50" y2="75" stroke="#cbd5e1" strokeWidth="6" />
                <path d="M 50 75 L 40 60 L 60 60 Z" fill="#3b82f6" />
                <defs>
                  <pattern id="strings" width="8" height="8" patternUnits="userSpaceOnUse">
                    <rect width="8" height="8" fill="none" stroke="#64748b" strokeWidth="0.75" />
                  </pattern>
                </defs>
                <ellipse cx="50" cy="50" rx="28" ry="38" fill="url(#strings)" stroke="#3b82f6" strokeWidth="6" />
              </svg>
            </div>
            <div className="shuttle-anim absolute top-1/2 left-1/2 -ml-[30px] -mt-[30px] w-[60px] h-[60px]">
              <svg width="60" height="60" viewBox="0 0 60 60">
                <path d="M 22 45 A 8 8 0 0 0 38 45 Z" fill="#ef4444" />
                <rect x="22" y="42" width="16" height="3" fill="#ffffff" />
                <path d="M 22 42 L 10 10 L 50 10 L 38 42 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" />
                <line x1="26" y1="42" x2="20" y2="10" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="30" y1="42" x2="30" y2="10" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="34" y1="42" x2="40" y2="10" stroke="#cbd5e1" strokeWidth="1.5" />
                <path d="M 12 25 Q 30 32 48 25" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
                <path d="M 17 35 Q 30 39 43 35" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="spark-anim absolute top-1/2 left-1/2 ml-[10px] mt-[10px] w-[60px] h-[60px] -translate-x-1/2 -translate-y-1/2">
              <svg viewBox="0 0 100 100">
                <path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill="#fef08a" />
              </svg>
            </div>
          </div>

          {/* Bottom text */}
          <div className="absolute bottom-14 left-0 right-0 text-center z-10 flex flex-col items-center">
            <h2 className="text-2xl font-bold text-amber-500 tracking-[0.25em] uppercase drop-shadow-sm">Badminton</h2>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-8 h-[2px] bg-white/40" />
              <h3 className="text-lg font-semibold text-slate-100 tracking-[0.4em] uppercase">Club</h3>
              <div className="w-8 h-[2px] bg-white/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
