import { lazy, Suspense, useEffect } from 'react';
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
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Router base={Capacitor.isNativePlatform() ? "" : "/iiscshuttlers"}>
            <ScrollToTop />
            <div className="flex flex-col min-h-screen">
              <Navigation />
              <StatusBanner />
              <main className="flex-1">
                <AppRoutes />
              </main>
              <Footer />
            </div>
          </Router>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
