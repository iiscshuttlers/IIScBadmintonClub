import type { ReactNode } from "react";
import { Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import { ChevronRight, Info, Trophy } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cssVar } from "@/lib/themeColors";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { ActiveTournamentWidget } from "@/components/home/ActiveTournamentWidget";
import { HomeAnnouncementBar } from "@/components/home/HomeAnnouncementBar";
import { NoticeBoard } from "@/components/home/NoticeBoard";
import { HomeMatchRail } from "@/components/home/HomeMatchRail";

/**
 * Home answers "what's on now?" in at most three blocks:
 *   1. your matches (signed in): next/live match + check-in, then follows
 *   2. happening now: the active tournament with live scores
 *   3. notices: the pinned banner and the club noticeboard
 * The club's about/leadership content lives in Club → About & Contact.
 */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function Home() {
  const { isAdmin, session } = useAuth();
  const { userName } = useNavigationAuth();
  const firstName = session ? (userName || "").trim().split(/\s+/)[0] : "";

  usePageMeta({
    title: "Home",
    description:
      "IISc Badminton Club — join a vibrant community of players, from beginners to champions, all united by passion for the sport.",
  });

  return (
    <div className="min-h-screen flex flex-col pb-8 bg-background">
      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section aria-label="Hero" className="relative overflow-hidden text-foreground py-2 lg:py-4 flex items-center bg-background">
        <div className="absolute inset-0 z-0" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-tr from-background via-card to-background" />
          <div className="absolute inset-0 hero-pattern opacity-30" />
          <div className="absolute top-1/4 right-[15%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/3 left-[10%] w-[400px] h-[400px] bg-team/10 rounded-full blur-[80px]" />
          <div className="absolute inset-0 dot-pattern opacity-30" />
        </div>

        <div className="container mx-auto px-4 pt-6 sm:pt-10 pb-2 lg:pt-2 lg:pb-2 relative z-10 w-full max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <motion.div variants={fadeUp} initial="hidden" animate="visible">
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black leading-[1.1] tracking-tight text-foreground font-display">
                {firstName ? (
                  <>
                    Welcome back, <span className="text-primary">{firstName}</span>
                  </>
                ) : (
                  <>
                    Welcome to the <br className="hidden sm:block" />
                    <span className="text-primary">IISc</span> Badminton Club
                  </>
                )}
              </h1>
            </motion.div>

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
      </section>

      <div className="container mx-auto px-4 max-w-5xl">
        {/* Pinned notice: the admin's top "show on home" banner */}
        <HomeAnnouncementBar isAdmin={isAdmin} />

        {/* 1. Your matches (signed in only) */}
        <HomeMatchRail />

        {/* 2. Happening now */}
        <ActiveTournamentWidget />

        {/* 3. Club noticeboard */}
        <NoticeBoard />

        {/* Quiet links: the club story and hosting live one tap away */}
        <nav aria-label="More from the club" className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <QuietLink href="/club?tab=about" icon={<Info className="w-4 h-4 text-primary" aria-hidden />} title="About the club" subtitle="Mission, values and leadership" />
          <QuietLink href="/host-tournament" icon={<Trophy className="w-4 h-4 text-primary" aria-hidden />} title="Host a tournament" subtitle="Run your own event on the app" />
        </nav>
      </div>
    </div>
  );
}

function QuietLink({ href, icon, title, subtitle }: { href: string; icon: ReactNode; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 min-h-[56px] px-4 py-3 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-foreground leading-tight">{title}</span>
        <span className="block text-xs text-muted-foreground truncate">{subtitle}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" aria-hidden />
    </Link>
  );
}

// ── Animated Logo ─────────────────────────────────────────────────────────────
function AnimatedLogo() {
  return (
    <div className="relative flex items-center justify-center overflow-visible">
      <div className="relative flex-shrink-0" style={{ width: "min(260px, 75vw)", height: "min(260px, 75vw)" }}>
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-background to-info/20 shadow-2xl border-[8px] border-border flex flex-col items-center justify-center overflow-hidden ring-[6px] ring-warning">
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke={cssVar("warning")} strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* IISc silhouette */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] opacity-20 text-warning pointer-events-none mt-2">
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
            <p className="text-7xl font-black text-foreground tracking-wider drop-shadow-md flex items-baseline" aria-hidden>
              IIS<span className="text-6xl text-warning ml-0.5">c</span>
            </p>
          </div>

          {/* Central animations */}
          <div className="absolute inset-0 z-20 pointer-events-none transform scale-75 origin-center">
            <div className="racket-anim absolute top-1/2 left-1/2 -ml-[50px] -mt-[50px] w-[100px] h-[180px]">
              <svg width="100" height="180" viewBox="0 0 100 180">
                <rect x="42" y="120" width="16" height="50" fill={cssVar("warning")} rx="2" />
                <rect x="42" y="165" width="16" height="5" fill={cssVar("secondary")} rx="1" />
                <rect x="44" y="115" width="12" height="5" fill={cssVar("muted-foreground")} />
                <line x1="50" y1="115" x2="50" y2="75" stroke={cssVar("soft")} strokeWidth="6" />
                <path d="M 50 75 L 40 60 L 60 60 Z" fill={cssVar("info")} />
                <defs>
                  <pattern id="strings" width="8" height="8" patternUnits="userSpaceOnUse">
                    <rect width="8" height="8" fill="none" stroke={cssVar("faint")} strokeWidth="0.75" />
                  </pattern>
                </defs>
                <ellipse cx="50" cy="50" rx="28" ry="38" fill="url(#strings)" stroke={cssVar("info")} strokeWidth="6" />
              </svg>
            </div>
            <div className="shuttle-anim absolute top-1/2 left-1/2 -ml-[30px] -mt-[30px] w-[60px] h-[60px]">
              <svg width="60" height="60" viewBox="0 0 60 60">
                <path d="M 22 45 A 8 8 0 0 0 38 45 Z" fill={cssVar("danger")} />
                <rect x="22" y="42" width="16" height="3" fill={cssVar("foreground")} />
                <path d="M 22 42 L 10 10 L 50 10 L 38 42 Z" fill={cssVar("foreground")} stroke={cssVar("muted-foreground")} strokeWidth="1.5" strokeLinejoin="round" />
                <line x1="26" y1="42" x2="20" y2="10" stroke={cssVar("muted-foreground")} strokeWidth="1.5" />
                <line x1="30" y1="42" x2="30" y2="10" stroke={cssVar("muted-foreground")} strokeWidth="1.5" />
                <line x1="34" y1="42" x2="40" y2="10" stroke={cssVar("muted-foreground")} strokeWidth="1.5" />
                <path d="M 12 25 Q 30 32 48 25" fill="none" stroke={cssVar("muted-foreground")} strokeWidth="1.5" />
                <path d="M 17 35 Q 30 39 43 35" fill="none" stroke={cssVar("muted-foreground")} strokeWidth="1.5" />
              </svg>
            </div>
            <div className="spark-anim absolute top-1/2 left-1/2 ml-[10px] mt-[10px] w-[60px] h-[60px] -translate-x-1/2 -translate-y-1/2">
              <svg viewBox="0 0 100 100">
                <path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill={cssVar("gold")} />
              </svg>
            </div>
          </div>

          {/* Bottom text */}
          <div className="absolute bottom-14 left-0 right-0 text-center z-10 flex flex-col items-center" aria-hidden>
            <p className="text-2xl font-bold text-warning tracking-[0.25em] uppercase drop-shadow-sm">Badminton</p>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-8 h-[2px] bg-foreground/40" />
              <p className="text-lg font-semibold text-foreground tracking-[0.4em] uppercase">Club</p>
              <div className="w-8 h-[2px] bg-foreground/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
