import { lazy, Suspense, useEffect, useState, useRef } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router, useLocation } from 'wouter';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { AnimatePresence, motion } from 'framer-motion';

import StatusBanner from "@/components/StatusBanner";
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import { supabase } from './lib/supabase';

// Eagerly loaded (small, always needed)
import Home from './pages/Home';
import About from './pages/About';
import Facilities from './pages/Facilities';
import Events from './pages/Events';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

// Lazy loaded (large or rarely visited)
const Announcements    = lazy(() => import('./pages/Announcements'));
const Gallery          = lazy(() => import('./pages/Gallery'));
const TournamentDetail = lazy(() => import('./pages/TournamentDetail'));
const WinnersWall      = lazy(() => import('./pages/WinnersWall'));
const LiveTournament = lazy(() => import('./pages/LiveTournament'));
// TournamentAdmin merged into SiteAdmin — /tournament/admin redirects to /admin
const SiteAdmin        = lazy(() => import('./pages/SiteAdmin'));
const PlayerProfile    = lazy(() => import('./pages/PlayerProfile'));
const Join             = lazy(() => import('./pages/Join'));
const ProfileSetup     = lazy(() => import('./pages/ProfileSetup'));
const PlayersDirectory = lazy(() => import('./pages/PlayersDirectory'));
const Invicta          = lazy(() => import('./pages/Invicta'));

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function PageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:shadow-emerald-200 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 15l-6-6-6 6"/>
      </svg>
    </button>
  );
}

function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop || document.body.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setPct(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-emerald-500 transition-[width] duration-75 ease-out shadow-[0_0_8px_rgba(16,185,129,0.6)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function AppRoutes() {
  const [location] = useLocation();

  return (
    // initial={false} → first render starts in animate state (no invisible flash)
    // No mode="wait" → enter/exit overlap, avoids timing glitches
    <AnimatePresence initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <Suspense fallback={<PageSkeleton />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/about" component={About} />
            <Route path="/facilities" component={Facilities} />

            <Route path="/admin" component={SiteAdmin} />
            <Route path="/tournament/admin" component={SiteAdmin} />
            <Route path="/tournament" component={LiveTournament} />
            <Route path="/events/:slug" component={TournamentDetail} />

            <Route path="/events" component={Events} />
            <Route path="/invicta" component={Invicta} />
            <Route path="/winners" component={WinnersWall} />

            <Route path="/announcements" component={Announcements} />
            <Route path="/gallery" component={Gallery} />
            <Route path="/contact" component={Contact} />
            <Route path="/join" component={Join} />
            <Route path="/profile/setup" component={ProfileSetup} />
            <Route path="/players" component={PlayersDirectory} />
            <Route path="/player/:id/edit" component={ProfileSetup} />
            <Route path="/player/:id" component={PlayerProfile} />

            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const backPressedRef = useRef(false);

  // Android hardware back button handler
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleBackButton = CapApp.addListener('backButton', ({ canGoBack }) => {
      const currentPath = window.location.pathname;
      const isHomePage = currentPath === '/' || currentPath === '' ||
        currentPath === '/iiscshuttlers' || currentPath === '/iiscshuttlers/';

      if (!isHomePage && canGoBack) {
        // Navigate back within the app
        window.history.back();
        return;
      }

      // On home screen — double-back to exit
      if (backPressedRef.current) {
        CapApp.exitApp();
        return;
      }

      backPressedRef.current = true;
      // Show a toast-style overlay
      const toast = document.createElement('div');
      toast.textContent = 'Press back again to exit';
      Object.assign(toast.style, {
        position: 'fixed', bottom: '40px', left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15,23,42,0.92)', color: '#fff',
        padding: '10px 22px', borderRadius: '30px',
        fontSize: '14px', fontWeight: '600',
        zIndex: '99999', backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
      });
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { document.body.removeChild(toast); backPressedRef.current = false; }, 300);
      }, 2000);
    });

    return () => { handleBackButton.then(h => h.remove()); };
  }, []);

  // Global Session Auto-Logout on Inactivity (30 Minutes)
  useEffect(() => {
    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.auth.signOut();
          alert("Your session has expired due to inactivity. Please log in again.");
          window.location.href = "/iiscshuttlers/join";
        }
      }, 30 * 60 * 1000); // 30 minutes of inactivity
    };

    // Track user movements/inputs
    const events = ["mousemove", "keypress", "click", "scroll", "touchstart"];
    events.forEach((name) => window.addEventListener(name, resetTimer, { passive: true }));

    // Start timer on load
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((name) => window.removeEventListener(name, resetTimer));
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Router base={Capacitor.isNativePlatform() ? "" : import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ScrollToTop />
            <ScrollProgress />
            <div className="flex flex-col min-h-screen">
              <Navigation />
              <StatusBanner />
              <main className="flex-1">
                <AppRoutes />
              </main>
              <Footer />
            </div>
            <BackToTop />
          </Router>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
