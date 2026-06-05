import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bell, CalendarDays, CheckCircle2, Medal, Trophy, Users } from 'lucide-react';
import iiscTeam from "@/assets/iisc-team.jpg";
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion, type Variants } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import RunningFlyer from '@/components/RunningFlyer';
import { useAuth } from '@/contexts/AuthContext';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const cardVariant: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/**
 * Home Page
 * Design: Dynamic Sports Energy - Hero section with action shot, asymmetric layout
 * Features: Hero banner, key highlights, call-to-action sections
 */
export default function Home() {
  usePageMeta({
    title: 'Home',
    description: 'IISc Badminton Club — join a vibrant community of players, from beginners to champions, all united by passion for the sport.',
  });

  const [, setLocation] = useLocation();
  const [isImageOpen, setIsImageOpen] = useState(false);
  const { session, isInitializing: authLoading } = useAuth();

  // On PWA launch: redirect to /join if not logged in and haven't chosen Guest this session
  useEffect(() => {
    if (authLoading) return; // wait for session to resolve
    if (sessionStorage.getItem("guest_mode")) return;
    if (!session) setLocation("/join");
  }, [authLoading, session, setLocation]);

  return (
    <div className="min-h-screen">
      <RunningFlyer />

      {/* Hero Section */}
      <section className="relative overflow-hidden text-white">

        {/* Mobile: team photo background (hidden on lg+) */}
        <div className="lg:hidden absolute inset-0 z-0">
          <img
            src={iiscTeam}
            alt="IISc Badminton Team"
            className="w-full h-full object-cover object-[25%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/85 via-blue-900/70 to-emerald-900/90" />
        </div>

        {/* Desktop: gradient background (hidden on mobile) */}
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-emerald-900 z-0">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 1200 600" preserveAspectRatio="none">
              <polygon points="0,0 1200,0 1200,400 0,600" fill="white" />
            </svg>
          </div>
        </div>

        <div className="container mx-auto px-4 py-20 lg:py-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700">
              <div className="inline-block">
                <span className="bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  Welcome to Excellence
                </span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
                IISc Badminton Club
              </h1>
              <p className="text-xl text-gray-200 leading-relaxed">
                Experience the thrill of competitive badminton. Join our vibrant community of players, from beginners to champions, all united by passion for the sport.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/about">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-lg font-semibold flex items-center gap-2 w-full sm:w-auto justify-center">
                    Learn More <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg font-semibold w-full sm:w-auto">
                    Get In Touch
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: Animated Logo (desktop only) */}
            <div className="hidden lg:flex relative animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
              <div className="relative flex items-center justify-center">
                <AnimatedLogo />
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-orange-500 rounded-full opacity-20 blur-3xl z-[-1]"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Paths Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <motion.div
            className="grid md:grid-cols-3 gap-6"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {[
              { href: '/events', title: 'Events', description: 'Browse live, upcoming and archived tournaments.', icon: CalendarDays },
              { href: '/winners', title: 'Winners Wall', description: 'See champions and podiums from club events.', icon: Medal },
              { href: '/announcements', title: 'Announcements', description: 'Check court notices, event updates and club news.', icon: Bell },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.href} variants={cardVariant}>
                  <Link href={item.href}>
                    <div className="h-full rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition duration-300 cursor-pointer">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5">
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-2xl font-bold text-blue-900 mb-2">{item.title}</h3>
                      <p className="text-gray-600">{item.description}</p>
                      <div className="mt-5 inline-flex items-center gap-2 font-bold text-blue-900">
                        Open <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <motion.section
        className="py-16 bg-white dark:bg-slate-900"
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <div className="container mx-auto px-4">
          <motion.h2
            variants={fadeUp}
            className="text-center text-3xl font-bold text-blue-900 dark:text-white mb-10"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Club at a Glance
          </motion.h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { target: 350, suffix: '+', label: 'Active Members', icon: Users, color: 'bg-emerald-500' },
              { target: 20, suffix: '+', label: 'Tournaments Hosted', icon: Trophy, color: 'bg-amber-500' },
              { target: 3, suffix: '', label: 'Indoor Courts', icon: CalendarDays, color: 'bg-blue-900' },
              { target: 10, suffix: '+', label: 'IISM Trophies', icon: Medal, color: 'bg-orange-500' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  variants={cardVariant}
                  className="text-center p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-700 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300"
                >
                  <div className={`inline-flex p-3 ${stat.color} rounded-xl mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CountUpNumber target={stat.target} suffix={stat.suffix} />
                  <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* Featured Section */}
      <motion.section
        className="py-20 bg-gradient-to-r from-blue-50 to-emerald-50"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-blue-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Why Join Us?</h2>
            <div className="w-16 h-1 bg-gradient-to-r from-emerald-500 to-orange-500 mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              {[
                { title: 'State-of-the-Art Facilities', desc: 'Access to 3 professional indoor courts with synthetic mat on wooden floors and modern lighting.', color: 'text-emerald-500' },
                { title: 'Regular Events', desc: 'Participate in friendly matches, tournaments, and inter-college competitions.', color: 'text-emerald-500' },
                { title: 'Open to All Levels', desc: 'Whether you\'re a beginner or seasoned player, there\'s a place for you at IISc Badminton Club.', color: 'text-emerald-500' },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 items-start">
                  <CheckCircle2 className={`w-6 h-6 mt-1 shrink-0 ${item.color}`} />
                  <div>
                    <h4 className="text-xl font-bold text-blue-900 dark:text-white">{item.title}</h4>
                    <p className="text-gray-600 dark:text-slate-400 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div 
              className="relative rounded-lg overflow-hidden shadow-xl cursor-pointer group"
              onClick={() => setIsImageOpen(true)}
            >
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors z-10 flex items-center justify-center">
                <span className="text-white opacity-0 group-hover:opacity-100 font-semibold drop-shadow-md transition-opacity">Click to enlarge</span>
              </div>
              <img src={iiscTeam} alt="IISc Badminton Team" loading="lazy" className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
          </div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        className="py-16 bg-blue-900 text-white"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>Ready to Join Our Club?</h2>
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Whether you're a seasoned player or just starting out, there's a place for you in the IISc Badminton Club.
          </p>
          <Link href="/contact">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-6 text-lg font-semibold">
              Get Started Today
            </Button>
          </Link>
        </div>
      </motion.section>

      {/* Fullscreen Image Modal */}
      {isImageOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setIsImageOpen(false)}
        >
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              setIsImageOpen(false);
            }}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img loading="lazy" 
            src={iiscTeam} 
            alt="IISc Badminton Team Full" 
            className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}


// ==========================================
// Count-up number for the stats section
// ==========================================
function CountUpNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const duration = 1200;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setCount(Math.round(eased * target));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-3xl font-black text-blue-900 dark:text-white">
      {count}{suffix}
    </div>
  );
}

// ==========================================
// The Animated Logo Component
// ==========================================
function AnimatedLogo() {
  return (
    <div className="relative flex items-center justify-center bg-transparent overflow-visible">

      {/* Scaling wrapper — responsive on mobile */}
      <div className="relative flex-shrink-0" style={{ width: 'min(380px, 85vw)', height: 'min(380px, 85vw)' }}>

        {/* Outer Ring & Badge Background */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-blue-950 to-slate-900 shadow-2xl border-[8px] border-slate-950 flex flex-col items-center justify-center overflow-hidden ring-[6px] ring-amber-500 z-0">

          {/* Subtle Background Grid (Court Feel) */}
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

          {/* IISc Main Building Silhouette */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] opacity-20 text-amber-500 pointer-events-none mt-2 z-0">
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

          {/* Top Text: IISc */}
          <div className="absolute top-16 left-0 right-0 text-center z-10 flex flex-col items-center">
            <h1 className="text-7xl font-black text-white tracking-wider drop-shadow-md flex items-baseline">
              IIS<span className="text-6xl text-amber-400 ml-0.5">c</span>
            </h1>
          </div>

          {/* Central Animation Zone */}
          <div className="absolute inset-0 z-20 pointer-events-none">

            {/* Racket Container */}
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

            {/* Shuttlecock Container */}
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

            {/* Impact Spark Effect */}
            <div className="spark-anim absolute top-1/2 left-1/2 ml-[10px] mt-[10px] w-[60px] h-[60px] -translate-x-1/2 -translate-y-1/2">
              <svg viewBox="0 0 100 100">
                <path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill="#fef08a" />
              </svg>
            </div>
          </div>

          {/* Bottom Text: BADMINTON CLUB */}
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

      {/* Internal Stylesheet for Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .marquee-anim {
          display: flex;
          width: max-content;
          animation: marquee 25s linear infinite;
        }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

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
      `}} />
    </div>
  );
}
