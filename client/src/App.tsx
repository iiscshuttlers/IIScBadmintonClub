import { lazy, Suspense, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router, useLocation } from 'wouter';
import { Capacitor } from '@capacitor/core';
import { AnimatePresence, motion } from 'framer-motion';

import StatusBanner from "@/components/StatusBanner";
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import Navigation from './components/Navigation';
import Footer from './components/Footer';

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
const FarewellTournament = lazy(() => import('./pages/FarewellTournament'));
const FarewellAdmin    = lazy(() => import('./pages/FarewellAdmin'));
const PlayerProfile    = lazy(() => import('./pages/PlayerProfile'));
const Join             = lazy(() => import('./pages/Join'));

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

            <Route path="/farewell/admin" component={FarewellAdmin} />
            <Route path="/farewell" component={FarewellTournament} />
            <Route path="/events/:slug" component={TournamentDetail} />

            <Route path="/events" component={Events} />
            <Route path="/winners" component={WinnersWall} />

            <Route path="/announcements" component={Announcements} />
            <Route path="/gallery" component={Gallery} />
            <Route path="/contact" component={Contact} />
            <Route path="/join" component={Join} />
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
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Router base={Capacitor.isNativePlatform() ? "" : "/iiscshuttlers"}>
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
