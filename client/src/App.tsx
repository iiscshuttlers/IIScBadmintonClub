import { lazy, Suspense, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router, useLocation } from 'wouter';
import { Capacitor } from '@capacitor/core';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

import StatusBanner from "@/components/StatusBanner";
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { PwaInstallPrompt } from './components/pwa/PwaInstallPrompt';
import { PwaUpdatePrompt } from './components/pwa/PwaUpdatePrompt';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import MobileBottomNav from './components/MobileBottomNav';
import MatchAlert from './components/MatchAlert';
import { useAppUpdate, type AppUpdateInfo } from './hooks/useAppUpdate';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import { useNativeBackButton } from './hooks/useNativeBackButton';
import { usePullToRefresh } from './hooks/usePullToRefresh';

import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

function UpdateDialog({ info, onDismiss }: { info: AppUpdateInfo; onDismiss: () => void }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadAndInstall = async () => {
    if (!Capacitor.isNativePlatform()) {
      window.open(info.downloadUrl, '_blank');
      return;
    }
    
    try {
      setDownloading(true);
      const fileName = `IIScShuttlers_${info.versionName}.apk`;
      
      const downloadResult = await Filesystem.downloadFile({
        url: info.downloadUrl,
        path: fileName,
        directory: Directory.Cache
      });
      
      if (downloadResult.path) {
        await FileOpener.open({
          filePath: downloadResult.path,
          contentType: 'application/vnd.android.package-archive'
        });
      }
    } catch (error) {
      console.error('Download failed', error);
      // Fallback if filesystem plugin fails
      window.open(info.downloadUrl, '_system');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-7 space-y-5">
        <div className="text-center space-y-1">
          <div className="text-4xl mb-2">🏸</div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Update Available</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Version {info.versionName} is ready</p>
        </div>
        {info.changelog && (
          <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3">
            {info.changelog}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleDownloadAndInstall}
            disabled={downloading}
            className={`w-full ${downloading ? 'bg-emerald-800' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold py-3 rounded-xl text-center transition-colors`}
          >
            {downloading ? 'Downloading...' : 'Download Update'}
          </button>
          <button
            onClick={onDismiss}
            className="w-full text-slate-500 dark:text-slate-400 font-medium py-2 text-sm hover:text-slate-700 transition-colors"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}

// Eagerly loaded (small, always needed)
import Home from './pages/Home';
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
      <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
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
            <Route path="/matches">
              <PlayerProfile matchesOnly={true} />
            </Route>

            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const { updateInfo, dismissUpdate } = useAppUpdate();
  useInactivityLogout();
  useNativeBackButton();
  usePullToRefresh();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <AuthProvider>
          <TooltipProvider>
            <Router base={Capacitor.isNativePlatform() ? "" : import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ScrollToTop />
              <ScrollProgress />
              <div className="flex flex-col min-h-screen">
                <PwaInstallPrompt />
                <Navigation />
                <StatusBanner />
                <main className="flex-1 pb-20 lg:pb-0">
                  <AppRoutes />
                </main>
                <Footer />
              </div>
              <BackToTop />
              <MobileBottomNav />
            </Router>
            <Toaster />
            <PwaUpdatePrompt />
            <MatchAlert />
            {updateInfo && <UpdateDialog info={updateInfo} onDismiss={dismissUpdate} />}
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
