import { Sparkles, ShieldCheck, Activity, Award, Target, Handshake, Sprout } from "lucide-react";
import { Link } from "wouter";
import { Capacitor } from "@capacitor/core";
import { Geofence } from "@/lib/geofence";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Calendar,
  Medal,
  Trophy,
  Users,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Star,
  Zap,
  MapPin,
  Map,
} from "lucide-react";
import iiscTeam from "@/assets/iisc-team.jpg";
import { usePageMeta } from "@/hooks/usePageMeta";
import { motion, type Variants } from "framer-motion";
import { useState, useEffect } from "react";
import { useArchivedTournaments } from "@/hooks/useArchivedTournaments";
import { ArchivedTournament } from "@/data/tournamentArchive";
import { fetchSiteData } from "@/lib/siteData";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { InfoModal } from "@/components/InfoModal";
import type { ConvenerData } from "@/components/admin/ConvenerEditor";
// import { VenueTrafficWidget } from "@/components/home/VenueTrafficWidget";
import { ActiveTournamentWidget } from "@/components/home/ActiveTournamentWidget";
import { HomeAnnouncementBar } from "@/components/home/HomeAnnouncementBar";
import { useAuth } from "@/contexts/AuthContext";
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

function getLatestHighlight(archivedTournaments: ArchivedTournament[]) {
  const completed = archivedTournaments.filter((t) => t.status === "completed" || t.status === "archived");
  if (!completed.length) return null;
  return [...completed].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

export default function Home() {
  const { archivedTournaments } = useArchivedTournaments();
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [convenerData, setConvenerData] = useState<ConvenerData | null>(null);

  useEffect(() => {
    fetchSiteData("club_settings", "settings.json")
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
  const [showAbout, setShowAbout] = useState(false);

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

  const highlight = getLatestHighlight(archivedTournaments);

  return (
    <>
      <div className="min-h-screen flex flex-col pb-0 bg-slate-950">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section aria-label="Hero" className="relative overflow-hidden text-white py-2 lg:py-4 flex items-center bg-slate-950">
          {/* Universal bg */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950" />
            <div className="absolute inset-0 hero-pattern opacity-30" />
            {/* decorative glow orbs */}
            <div className="absolute top-1/4 right-[15%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/3 left-[10%] w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[80px]" />
            <div className="absolute top-1/3 left-[40%] w-[300px] h-[300px] bg-primary/5 rounded-full blur-[60px]" />
            {/* dot grid */}
            <div className="absolute inset-0 dot-pattern opacity-30" />
          </div>

          <div className="container mx-auto px-4 pt-6 sm:pt-12 pb-1 lg:pt-2 lg:pb-2 relative z-10 w-full max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">

              {/* Left Content */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-2">
                {/* Heading */}
                <div className="space-y-4">
                  <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black leading-[1.1] tracking-tight text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]" style={{ fontFamily: "Playfair Display, serif" }}>
                    Welcome to the <br className="hidden sm:block" />
                    <span className="text-primary drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">IISc</span> Badminton Club
                  </h1>
                </div>

              </motion.div>

              {/* Right: Animated Logo */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.15 }}
                className="hidden lg:flex justify-center items-center scale-50 lg:scale-75 transform origin-center"
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
        


        {/* <VenueTrafficWidget /> */}

        {/* ── QUICK PATHS ──────────────────────────────────────────────── */}
        <section aria-label="Quick Links" className="bg-slate-50 dark:bg-transparent">
          <div className="container mx-auto px-4 max-w-5xl">
            
            <HomeAnnouncementBar isAdmin={isAdmin} />

            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
              <ActiveTournamentWidget />
            </motion.div>



          </div>
        </section>


        {/* ── ABOUT / MISSION & VALUES ──────────────────────────────────── */}
        <section aria-label="About & Mission" className="py-2 bg-white dark:bg-slate-950">
          <div className="container mx-auto px-4 max-w-5xl">
            <motion.div
              className="mb-2"
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            >
              <div className="inline-flex items-center justify-between w-full cursor-pointer group" onClick={() => setShowAbout(!showAbout)}>
                <div>
                  <h2 className="text-xl lg:text-2xl font-black text-foreground dark:text-foreground mb-1 leading-tight" style={{ fontFamily: "Playfair Display, serif" }}>
                    About IISc
                    <span className="text-primary dark:text-primary"> Badminton Club</span>
                  </h2>
                </div>
                <div className="ml-4 shrink-0 text-slate-400 group-hover:text-primary transition-colors bg-slate-100 dark:bg-slate-800 p-2 sm:p-3 rounded-full">
                  {showAbout ? <ChevronUp className="w-6 h-6 sm:w-8 sm:h-8" /> : <ChevronDown className="w-6 h-6 sm:w-8 sm:h-8" />}
                </div>
              </div>
            </motion.div>

            {showAbout && (
              <motion.div
                className="flex flex-col gap-5 items-start mt-2"
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                  {VALUES.map(({ title, desc, Icon }) => (
                    <div
                      key={title}
                      className="group relative rounded-2xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
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
            )}
            {/* Team Photo */}
            <motion.div
              className="mt-8 relative rounded-3xl overflow-hidden shadow-2xl cursor-pointer group border border-slate-200 dark:border-slate-700 max-w-5xl mx-auto"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              onClick={() => setIsImageOpen(true)}
            >
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
        <section aria-label="Leadership Team" className="flex-1 py-2 bg-slate-50 dark:bg-slate-950">
          <div className="container mx-auto px-4 max-w-5xl">
            <motion.div
              className="text-center mb-3"
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            >
              <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mb-1">Leadership</p>
              <h2 className="text-xl font-black text-foreground dark:text-foreground" style={{ fontFamily: "Playfair Display, serif" }}>
                Club Leadership
              </h2>
              <p className="text-muted-foreground dark:text-muted-foreground text-[10px] mt-0.5">The people keeping the shuttles flying</p>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 gap-3 md:gap-4 max-w-5xl mx-auto"
              variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
            >
              {teamMembers.map((member, idx) => {
                const gradients = ["from-primary to-teal-600", "from-blue-600 to-indigo-700"];
                const initials = member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <motion.div
                    key={idx}
                    variants={cardVariant}
                    className="flex flex-col items-center text-center gap-2 md:gap-4 p-3 md:p-5 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group backdrop-blur-sm"
                    onClick={() => member.image && !imageErrors[member.name] ? setSelectedImage(member.image) : undefined}
                  >
                    <div className={`flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${gradients[idx % 2]} flex items-center justify-center shadow-lg overflow-hidden ring-4 ring-white dark:ring-slate-700 group-hover:scale-105 transition-transform duration-300`}>
                      {member.image && !imageErrors[member.name] ? (
                        <img
                          loading="lazy"
                          src={member.image}
                          alt={member.name}
                          className="w-full h-full object-cover"
                          onError={() => setImageErrors((prev) => ({ ...prev, [member.name]: true }))}
                        />
                      ) : (
                        <span className="text-foreground text-xl font-black">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0 w-full">
                      <span className="inline-block text-[8px] sm:text-[9px] font-black text-primary dark:text-primary uppercase tracking-widest mb-1 px-2 py-0.5 bg-primary/10 dark:bg-primary/20 rounded-full border border-primary/20">
                        {member.role}
                      </span>
                      <h3 className="text-sm sm:text-xl font-black text-foreground dark:text-foreground leading-tight truncate px-1">{member.name}</h3>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    
    window.history.pushState({ imageModalOpen: true }, "");
    const handlePopState = () => onClose();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
      if (window.history.state?.imageModalOpen) {
        window.history.back();
      }
    };
  }, [onClose]);

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
