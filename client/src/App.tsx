import { lazy, Suspense, useEffect, useState, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router, useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, WifiOff } from "lucide-react";

import StatusBanner from "@/components/StatusBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PwaInstallPrompt } from "./components/pwa/PwaInstallPrompt";
import { PwaUpdatePrompt } from "./components/pwa/PwaUpdatePrompt";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";
import MatchAlert from "./components/MatchAlert";
import LogMatchModal from "./components/LogMatchModal";
import { useAppUpdate, AppUpdateProvider, type AppUpdateInfo } from "./hooks/useAppUpdate";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import { useNativeBackButton } from "./hooks/useNativeBackButton";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { useOverflowGuard } from "./hooks/useOverflowGuard";
import { useBroadcastNotification } from "./hooks/useBroadcastNotification";
import { usePingsNotification } from "./hooks/usePingsNotification";
import { initSounds, playOnUnlock, playSmashSound } from "./lib/sounds";
import { OnboardingTour } from "./components/OnboardingTour";

import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";

import { UpdateDialog } from "./components/layout/UpdateDialog";
import { PageSkeleton } from "./components/layout/PageSkeleton";
import { PageErrorFallback } from "./components/layout/PageErrorFallback";
import { BackToTop } from "./components/layout/BackToTop";
import { ScrollProgress } from "./components/layout/ScrollProgress";
import { ScrollToTop } from "./components/layout/ScrollToTop";
import { RoutePersistence } from "./components/layout/RoutePersistence";
import { AppModeProvider, useAppMode } from "./contexts/AppModeContext";

// NotFound is eagerly loaded (tiny, always needed as fallback)
import NotFound from "./pages/NotFound";

// All pages lazy-loaded for optimal bundle splitting
const Home = lazy(() => import("./pages/Home"));
const Hub = lazy(() => import("./pages/Hub"));
const Legacy = lazy(() => import("./pages/Legacy"));
const TournamentDetail = lazy(() => import("./pages/TournamentDetail"));
const Pulse = lazy(() => import("./pages/Pulse"));


// TournamentAdmin is the dedicated fullscreen Tournament Manager
const SiteAdmin = lazy(() => import("./pages/SiteAdmin"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const Join = lazy(() => import("./pages/Join"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));

const ComparePlayers = lazy(() => import("./pages/ComparePlayers"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));

const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const DoublesPairProfile = lazy(() => import("./pages/DoublesPairProfile"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));

const TournamentAdmin = lazy(() => import("./pages/TournamentAdmin"));

const PersonalProfilePage = lazy(() => import("./pages/personal/PersonalProfilePage"));

function PersonalModeRoute({ children }: { children: React.ReactNode }) {
  const { session, isInitializing } = useAuth();
  const [, setLocation] = useLocation();

  if (isInitializing) return <PageSkeleton />;

  if (!session) {
    // Redirect to login
    setLocation("/join");
    return null;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <Suspense fallback={<PageSkeleton />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/pulse" component={Pulse} />

          <Route path="/hub" component={Hub} />
          <Route path="/legacy" component={Legacy} />
          <Route path="/hall-of-fame" component={() => { window.location.href='/legacy#champions'; return null; }} />
          <Route path="/gallery" component={() => { window.location.href='/legacy#albums'; return null; }} />
          <Route path="/events/:slug" component={TournamentDetail} />
          <Route path="/join" component={Join} />
          <Route path="/player/:id">
            <ErrorBoundary fallback={<PageErrorFallback />}>
              <PlayerProfile />
            </ErrorBoundary>
          </Route>
          <Route path="/compare/:p1/:p2">
            <ErrorBoundary fallback={<PageErrorFallback />}>
              <ComparePlayers />
            </ErrorBoundary>
          </Route>
          <Route path="/doubles/:p1/:p2">
            <ErrorBoundary fallback={<PageErrorFallback />}>
              <DoublesPairProfile />
            </ErrorBoundary>
          </Route>
          {/* Keep legacy exchange/marketplace for redirects if needed */}
          <Route path="/marketplace" component={() => { window.location.href='/hub#exchange'; return null; }} />
          <Route path="/exchange" component={() => { window.location.href='/hub#exchange'; return null; }} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsOfService} />

          <Route path="/admin"><ProtectedRoute><SiteAdmin /></ProtectedRoute></Route>
          <Route path="/tournament-admin"><ProtectedRoute><TournamentAdmin /></ProtectedRoute></Route>
          <Route path="/profile/setup"><ProtectedRoute><ProfileSetup /></ProtectedRoute></Route>

          <Route path="/player/:id/edit"><ProtectedRoute><ProfileSetup /></ProtectedRoute></Route>
          <Route path="/profile/password"><ProtectedRoute><ChangePassword /></ProtectedRoute></Route>
          <Route path="/find-lost" component={() => { window.location.href='/hub#lost-found'; return null; }} />
          <Route path="/delete-account"><ProtectedRoute><DeleteAccount /></ProtectedRoute></Route>

          {/* Personal Mode Routes (Brainy-style navigation) */}
          <Route path="/personal"><PersonalModeRoute><PersonalProfilePage /></PersonalModeRoute></Route>
          <Route path="/personal/me"><PersonalModeRoute><PersonalProfilePage /></PersonalModeRoute></Route>
          <Route path="/personal/player/:id">
            <PersonalModeRoute>
              <ErrorBoundary fallback={<PageErrorFallback />}>
                <PlayerProfile />
              </ErrorBoundary>
            </PersonalModeRoute>
          </Route>

          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </ErrorBoundary>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[9998] flex items-center justify-center gap-2 bg-slate-800 text-foreground text-sm font-bold py-2 px-4 shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      You're offline — some features may be unavailable
    </div>
  );
}

function GlobalAuthHooks() {
  usePingsNotification();
  useBroadcastNotification();
  useEffect(() => {
    initSounds();
    playOnUnlock(playSmashSound); // shuttle smash on every page load/refresh
  }, []);
  return null;
}

function AppContent() {
  const { updateInfo, isDialogOpen, dismissUpdate } = useAppUpdate();
  const [isLogMatchOpen, setIsLogMatchOpen] = useState(false);
  const [defaultOpponentId, setDefaultOpponentId] = useState<string | undefined>(undefined);
  const { profile, session } = useAuth();
  const [, setLocation] = useLocation();
  const { mode } = useAppMode();

  useInactivityLogout();
  useNativeBackButton();
  usePullToRefresh();
  useOfflineSync();
  useOverflowGuard();

  // Handle deep links from QR codes and NFC scans
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleDeepLink = (event: any) => {
      const url = event.url;
      if (url) {
        try {
          // Handle iiscshuttlers:// scheme
          if (url.startsWith("iiscshuttlers://")) {
            const path = url.slice("iiscshuttlers://".length);
            // Preserve the full path including query params and hash
            setLocation("/" + path);
            return;
          }
          // Handle https URLs
          if (url.includes("iiscbadmintonclub.github.io")) {
            const parsed = new URL(url);
            // Extract everything after /iiscshuttlers, preserving query + hash
            const pathAfterBase = parsed.pathname.replace(/^\/iiscshuttlers/, "") || "/";
            const fullPath = pathAfterBase + parsed.search + parsed.hash;
            setLocation(fullPath);
          }
        } catch {
          // Fallback for malformed URLs
          setLocation("/");
        }
      }
    };

    let listenerHandle: { remove: () => void } | null = null;
    CapacitorApp.addListener("appUrlOpen", handleDeepLink).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      listenerHandle?.remove();
    };
  }, [setLocation]);

  useEffect(() => {
    const handleOpenLogMatch = (e: any) => {
      if (e.detail?.player2_id) {
        setDefaultOpponentId(e.detail.player2_id);
      } else {
        setDefaultOpponentId(undefined);
      }
      setIsLogMatchOpen(true);
    };
    window.addEventListener("openLogMatchModal", handleOpenLogMatch);
    return () =>
      window.removeEventListener("openLogMatchModal", handleOpenLogMatch);
  }, []);



  return (
          <TooltipProvider>
            <Router
              base={
                Capacitor.isNativePlatform()
                  ? ""
                  : import.meta.env.BASE_URL.replace(/\/$/, "")
              }
            >
              <ScrollToTop />
              <RoutePersistence />
              <ScrollProgress />
              <div data-overflow-root className={`flex flex-col min-h-screen overflow-x-clip ${session && mode === "personal" ? "lg:ml-64" : ""}`}>
                {/* Skip-to-content for keyboard / screen-reader users */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:font-bold focus:shadow-lg"
                >
                  Skip to content
                </a>
                <OfflineBanner />
                <PwaInstallPrompt />
                <Navigation />
                <StatusBanner />
                <main id="main-content" className={`flex-1 flex flex-col ${session ? "pb-24 lg:pb-0" : mode === "club" ? "pb-20 lg:pb-0" : ""} ${mode === "personal" ? "pt-[calc(3rem+env(safe-area-inset-top))] lg:pt-0" : ""}`}>
                  <AppRoutes />
                </main>
                <Footer />
              </div>
              <BackToTop />
            </Router>
            <Toaster />
            <PwaUpdatePrompt />
            <MatchAlert />
            {profile && (
              <LogMatchModal
                isOpen={isLogMatchOpen}
                onClose={() => {
                  setIsLogMatchOpen(false);
                  setDefaultOpponentId(undefined);
                }}
                currentUser={profile as any}
                onSuccess={() => setIsLogMatchOpen(false)}
                defaultOpponentId={defaultOpponentId}
              />
            )}
            <GlobalAuthHooks />
            <OnboardingTour />
            {isDialogOpen && updateInfo && (
              <UpdateDialog info={updateInfo} onDismiss={dismissUpdate} />
            )}
          </TooltipProvider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppUpdateProvider>
              <AppModeProvider>
                <AppContent />
              </AppModeProvider>
            </AppUpdateProvider>
          </AuthProvider>
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
