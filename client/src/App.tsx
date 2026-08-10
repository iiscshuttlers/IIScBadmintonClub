import { lazy, Suspense, useEffect, useState, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router, useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, WifiOff, ExternalLink } from "lucide-react";

import StatusBanner from "@/components/StatusBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GuestGate } from "@/components/GuestGate";
import { UmpireEngine } from "@/components/umpire/UmpireEngine";
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
import { useGlobalNotifications } from "./hooks/useGlobalNotifications";
import { useEngagementReminders } from "./hooks/useEngagementReminders";
import { initSounds, playOnUnlock, playSmashSound } from "./lib/sounds";
import { OnboardingTour } from "./components/OnboardingTour";
import { useShakeToFeedback } from "./hooks/useShakeToFeedback";
import { BetaFeedbackModal } from "@/components/BetaFeedbackModal";

import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";

import { UpdateDialog } from "./components/layout/UpdateDialog";
import { PageSkeleton } from "./components/layout/PageSkeleton";
import { PageErrorFallback } from "./components/layout/PageErrorFallback";
import { BackToTop } from "./components/layout/BackToTop";
import { ScrollProgress } from "./components/layout/ScrollProgress";
import { ScrollToTop } from "./components/layout/ScrollToTop";
import { RoutePersistence } from "./components/layout/RoutePersistence";
import { useAppMode } from "./contexts/AppModeContext";
import { AppProviders } from "./AppProviders";

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
const PlayerPersonalPage = lazy(() => import("./pages/PlayerPersonalPage"));
const Join = lazy(() => import("./pages/Join"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage"));
const MyMatchesPage = lazy(() => import("./pages/MyMatchesPage"));
const TournamentStandingsPage = lazy(() => import("./pages/TournamentStandingsPage"));

const ComparePlayers = lazy(() => import("./pages/ComparePlayers"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));

const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const DoublesPairProfile = lazy(() => import("./pages/DoublesPairProfile"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Glossary = lazy(() => import("./pages/Glossary"));

const TournamentAdmin = lazy(() => import("./pages/TournamentAdmin"));

const PersonalProfilePage = lazy(() => import("./pages/personal/PersonalProfilePage"));
const BroadcastOverlay = lazy(() => import("./pages/BroadcastOverlay"));

import { VenueWelcomeModal } from "@/components/VenueWelcomeModal";

const TvScoreboardIndex = lazy(() => import("@/pages/TvScoreboardIndex"));
const TvScoreboard = lazy(() => import("./pages/TvScoreboard"));
const ObsOverlayScoreboard = lazy(() => import("./pages/ObsOverlayScoreboard"));
const CameraBroadcast = lazy(() => import("./pages/CameraBroadcast"));

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
          <Route path="/pulse">
            <GuestGate feature="Pulse">
              <Pulse />
            </GuestGate>
          </Route>
          
          <Route path="/tv" component={TvScoreboardIndex} />
          <Route path="/tv/overlay/:matchId?" component={ObsOverlayScoreboard} />
          <Route path="/tv/camera/:matchId?">
            <ProtectedRoute>
              <CameraBroadcast />
            </ProtectedRoute>
          </Route>
          <Route path="/tv/:matchId" component={TvScoreboard} />

          <Route path="/hub">
            <GuestGate feature="Hub">
              <Hub />
            </GuestGate>
          </Route>
          <Route path="/legacy" component={Legacy} />
          <Route path="/hall-of-fame" component={() => { window.location.href=`${import.meta.env.BASE_URL}legacy#champions`; return null; }} />
          <Route path="/gallery" component={() => { window.location.href=`${import.meta.env.BASE_URL}legacy#albums`; return null; }} />
          <Route path="/events/:slug" component={TournamentDetail} />
          <Route path="/join" component={Join} />
          <Route path="/player/:id">
            <GuestGate feature="Player Profile">
              <ErrorBoundary fallback={<PageErrorFallback />}>
                <PlayerProfile />
              </ErrorBoundary>
            </GuestGate>
          </Route>
          <Route path="/player/:id/personal/*?">
            <Suspense fallback={<PageSkeleton />}>
              <ProtectedRoute>
                <PlayerPersonalPage />
              </ProtectedRoute>
            </Suspense>
          </Route>
          <Route path="/compare/:p1/:p2">
            <GuestGate feature="Compare Players">
              <ErrorBoundary fallback={<PageErrorFallback />}>
                <ComparePlayers />
              </ErrorBoundary>
            </GuestGate>
          </Route>
          <Route path="/doubles/:p1/:p2">
            <GuestGate feature="Doubles Pair">
              <ErrorBoundary fallback={<PageErrorFallback />}>
                <DoublesPairProfile />
              </ErrorBoundary>
            </GuestGate>
          </Route>
          {/* Keep legacy exchange/marketplace for redirects if needed */}
          <Route path="/marketplace" component={() => { window.location.href=`${import.meta.env.BASE_URL}hub?tab=exchange`; return null; }} />
          <Route path="/exchange" component={() => { window.location.href=`${import.meta.env.BASE_URL}hub?tab=exchange`; return null; }} />
          <Route path="/find-lost" component={() => { window.location.href=`${import.meta.env.BASE_URL}hub?tab=exchange&sub=lost-found`; return null; }} />
          <Route path="/umpire" component={() => { window.location.href=`${import.meta.env.BASE_URL}hub?tab=my_matches`; return null; }} />
          <Route path="/feed/announcements" component={() => { window.location.href=`${import.meta.env.BASE_URL}pulse#announcements`; return null; }} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsOfService} />
          <Route path="/glossary" component={Glossary} />
          <Route path="/login-callback" component={() => {
            const [, setLoc] = useLocation();
            useEffect(() => { setLoc("/"); }, [setLoc]);
            return null;
          }} />

          <Route path="/admin"><ProtectedRoute><SiteAdmin /></ProtectedRoute></Route>
          <Route path="/tournament-admin"><ProtectedRoute><TournamentAdmin /></ProtectedRoute></Route>
          <Route path="/profile/setup"><ProtectedRoute><ProfileSetup /></ProtectedRoute></Route>
          <Route path="/profile/subscriptions"><ProtectedRoute><SubscriptionsPage /></ProtectedRoute></Route>
          
          <Route path="/my-matches"><ProtectedRoute><MyMatchesPage /></ProtectedRoute></Route>
          <Route path="/standings" component={TournamentStandingsPage} />

          <Route path="/player/:id/edit"><ProtectedRoute><ProfileSetup /></ProtectedRoute></Route>
          <Route path="/profile/password"><ProtectedRoute><ChangePassword /></ProtectedRoute></Route>
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
          
          <Route path="/broadcast/:matchId" component={BroadcastOverlay} />

          {/* Test route exclusively for Playwright E2E */}
          <Route path="/test-umpire-engine" component={() => (
             <UmpireEngine 
               initialMatchState={{
                 id: "test-match-123",
                 status: "playing",
                 t1: { p1Name: "P1", score: 0, games: 0 },
                 t2: { p1Name: "P2", score: 0, games: 0 },
                 serverTeam: 1,
                 bestOfSets: 3,
                 category: "MS",
                 pointLog: []
               } as any}
               userId="test-user-123"
               userName="Test Umpire"
               userEmail="test@test.com"
               onClose={() => {}}
             />
          )} />

          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
        <VenueWelcomeModal />
      </Suspense>
    </ErrorBoundary>
  );
}

function GuestPromoBanner() {
  const { session } = useAuth();
  
  if (session) return null;
  // If we are already on the web platform, don't show the link to the web platform
  if (!Capacitor.isNativePlatform()) return null;
  
  return (
    <div className="bg-primary/10 border-b border-primary/20 text-foreground text-center py-2.5 px-4 text-[13px] font-medium z-50 flex items-center justify-center gap-2">
      <span className="opacity-90">For a better experience with all features, visit</span>
      <a 
        href="https://iiscshuttlers.github.io/IIScBadmintonClub/" 
        className="text-primary font-bold hover:underline transition-all flex items-center gap-1"
        target="_blank" 
        rel="noopener noreferrer"
      >
        IISc Badminton Club <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    let pollingTimer: ReturnType<typeof setTimeout>;

    const checkActualConnection = async () => {
      if (!navigator.onLine) {
        setOffline(true);
        return;
      }
      try {
        // Lightweight ping to our own server to detect Lie-Fi
        await fetch(window.location.origin + "/favicon.ico?_t=" + Date.now(), {
          mode: "no-cors",
          cache: "no-store",
          // The fetch will fail if there is no actual internet (Lie-Fi)
        });
        setOffline(false);
      } catch (e) {
        setOffline(true);
      }
      // Re-verify periodically with backoff (15s)
      pollingTimer = setTimeout(checkActualConnection, 15000);
    };

    const goOffline = () => {
      clearTimeout(pollingTimer);
      setOffline(true);
    };
    const goOnline = () => {
      checkActualConnection(); // Verify it's not Lie-Fi
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // Initial check
    checkActualConnection();

    return () => {
      clearTimeout(pollingTimer);
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
  useGlobalNotifications();
  useEngagementReminders();
  useEffect(() => {
    const unlockAudio = () => {
      initSounds();
      playOnUnlock(playSmashSound); // lazy load audio
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);
  return null;
}

function GlobalAuthGuard() {
  const { session, profile, isInitializing } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isInitializing) return;
    
    // If a user is signed in but has no profile, force them to the profile setup page
    if (session && !profile) {
      if (
        !location.startsWith("/profile/setup") && 
        !location.startsWith("/join") &&
        !location.startsWith("/404")
      ) {
        setLocation("/profile/setup");
      }
    }
  }, [session, profile, isInitializing, location, setLocation]);

  return null;
}

function AppContent() {
  const { updateInfo, isDialogOpen, dismissUpdate } = useAppUpdate();
  const [isLogMatchOpen, setIsLogMatchOpen] = useState(false);
  const [isBetaFeedbackOpen, setIsBetaFeedbackOpen] = useState(false);
  const [defaultOpponentId, setDefaultOpponentId] = useState<string | undefined>(undefined);
  const { profile, session } = useAuth();
  const [location, setLocation] = useLocation();
  const { mode } = useAppMode();

  useShakeToFeedback(() => {
    setIsBetaFeedbackOpen(true);
  });

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
            
            // CRITICAL: Feed auth tokens to Supabase before routing
            if (url.includes('#access_token=') || url.includes('?code=')) {
              if (url.includes('#')) {
                const hashPart = url.substring(url.indexOf('#'));
                // Sanitize: Allow only valid URI characters for Supabase OAuth hash
                if (/^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/.test(hashPart)) {
                  window.location.hash = hashPart;
                  // Supabase is statically imported, just call getSession to process the hash synchronously
                  supabase.auth.getSession();
                }
              }
            }
            
            // Preserve the full path including query params and hash, strictly sanitized
            const safePath = path.replace(/[^a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]/g, "");
            
            // If the redirect was specifically to our login-callback, 
            // redirect to the home page instead since the router doesn't have a /login-callback route
            if (safePath.startsWith("login-callback")) {
              setLocation("/");
            } else {
              setLocation("/" + safePath);
            }
            return;
          }
          // Handle https URLs
          if (url.includes("iiscbadmintonclub.github.io")) {
            // CRITICAL: Feed auth tokens to Supabase before routing
            if (url.includes('#access_token=') || url.includes('?code=')) {
              if (url.includes('#')) {
                const hashPart = url.substring(url.indexOf('#'));
                if (/^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/.test(hashPart)) {
                  window.location.hash = hashPart;
                  supabase.auth.getSession();
                }
              }
            }

            const parsed = new URL(url);
            // Extract everything after /iiscshuttlers, preserving query + hash
            const pathAfterBase = parsed.pathname.replace(/^\/iiscshuttlers\/?/, "") || "/";
            const fullPath = pathAfterBase + parsed.search + parsed.hash;
            const safeFullPath = fullPath.replace(/[^a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]/g, "");
            
            if (safeFullPath.startsWith("login-callback") || safeFullPath.startsWith("/login-callback")) {
              setLocation("/");
            } else {
              setLocation(safeFullPath.startsWith("/") ? safeFullPath : "/" + safeFullPath);
            }
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
              <GlobalAuthGuard />
              <OnboardingTour />
              <ScrollProgress />
              <div data-overflow-root className={`flex flex-col min-h-screen overflow-x-clip ${/^\/player\/[^/]+\/personal/.test(location) && !location.startsWith("/tv") ? "lg:ml-64" : ""}`}>
                {/* Skip-to-content for keyboard / screen-reader users */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:font-bold focus:shadow-lg"
                >
                  Skip to content
                </a>
                {!location.startsWith("/tv") && <OfflineBanner />}
                {!location.startsWith("/tv") && <PwaInstallPrompt />}
                {!location.startsWith("/tv") && <GuestPromoBanner />}
                {!location.startsWith("/tv") && <Navigation />}
                {!location.startsWith("/tv") && <StatusBanner />}
                <main id="main-content" className={`flex-1 flex flex-col ${location.startsWith("/tv") ? "" : session ? "pb-24 lg:pb-0" : mode === "club" ? "pb-20 lg:pb-0" : ""} ${location.startsWith("/tv") ? "" : /^\/player\/[^/]+\/personal/.test(location) ? "pt-[calc(3rem+env(safe-area-inset-top))] lg:pt-0" : ""}`}>
                  <AppRoutes />
                </main>
                {!location.startsWith("/tv") && <Footer />}
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
            <BetaFeedbackModal isOpen={isBetaFeedbackOpen} onClose={() => setIsBetaFeedbackOpen(false)} />
            {isDialogOpen && updateInfo && (
              <UpdateDialog info={updateInfo} onDismiss={dismissUpdate} />
            )}
          </TooltipProvider>
  );
}

function App() {
  return (
    <GlobalErrorBoundary>
      <AppProviders>
        <AppContent />
      </AppProviders>
    </GlobalErrorBoundary>
  );
}

export default App;
