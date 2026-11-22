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
import { appPathFromUrl } from "@/lib/deepLink";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GuestGate } from "@/components/GuestGate";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PwaInstallPrompt } from "./components/pwa/PwaInstallPrompt";
import { PwaUpdatePrompt } from "./components/pwa/PwaUpdatePrompt";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";
import { LegacyPulseRedirect } from "./components/routing/LegacyPulseRedirect";
import { SectionRedirect } from "./components/routing/SectionRedirect";
import { legacyRedirectTarget, personalRedirectTarget, pulseRedirectTarget } from "./lib/sectionRedirects";
import { useAppUpdate, AppUpdateProvider, type AppUpdateInfo } from "./hooks/useAppUpdate";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import { useNativeBackButton } from "./hooks/useNativeBackButton";
import { useNotificationDeepLinks } from "./hooks/useNotificationDeepLinks";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useOverflowGuard } from "./hooks/useOverflowGuard";
import { useTopTenAlert } from "./hooks/useTopTenAlert";
import { useGlobalNotifications } from "./hooks/useGlobalNotifications";
import { useEngagementReminders } from "./hooks/useEngagementReminders";
import { initSounds, playOnUnlock, playSmashSound } from "./lib/sounds";
import { OnboardingTour } from "./components/OnboardingTour";

// Native plugins registered at startup. UpdateDialog and the dev-only umpire
// route used to pull these in eagerly; both load lazily now, so the
// registrations stay here as bare imports (the TS transform drops unused
// named imports, which never registered anything on their own).
import "@capacitor/filesystem";
import "@capacitor-community/file-opener";
import "@capacitor/preferences";
import "@/lib/widgetManager";
import "@/lib/playerMotion";

import { PageSkeleton } from "./components/layout/PageSkeleton";
import { PageErrorFallback } from "./components/layout/PageErrorFallback";
import { BackToTop } from "./components/layout/BackToTop";
import { ScrollProgress } from "./components/layout/ScrollProgress";
import { ScrollToTop } from "./components/layout/ScrollToTop";
import { RoutePersistence } from "./components/layout/RoutePersistence";
import { PageViewTracker } from "./components/layout/PageViewTracker";
import { AppProviders } from "./AppProviders";

// NotFound is eagerly loaded (tiny, always needed as fallback)
import NotFound from "./pages/NotFound";

// All pages lazy-loaded for optimal bundle splitting
const Home = lazy(() => import("./pages/Home"));
const Hub = lazy(() => import("./pages/Hub"));
const Players = lazy(() => import("./pages/Players"));
const TournamentDetail = lazy(() => import("./pages/TournamentDetail"));
const TournamentsHub = lazy(() => import("./pages/TournamentsHub"));
const TournamentPage = lazy(() => import("./pages/TournamentPage"));
const VenueScoreboardPage = lazy(() => import("./pages/VenueScoreboardPage"));
const TournamentMatchPage = lazy(() => import("./pages/TournamentMatchPage"));
const MatchShortRedirect = lazy(() => import("./pages/TournamentMatchPage").then((m) => ({ default: m.MatchShortRedirect })));


// TournamentAdmin is the dedicated fullscreen Tournament Manager
const SiteAdmin = lazy(() => import("./pages/SiteAdmin"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const Join = lazy(() => import("./pages/Join"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage"));
const MyMatchesPage = lazy(() => import("./pages/MyMatchesPage"));
const TournamentStandingsPage = lazy(() => import("./pages/TournamentStandingsPage"));

const ComparePlayers = lazy(() => import("./pages/ComparePlayers"));
const HeadToHeadPage = lazy(() => import("./pages/HeadToHeadPage"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));

const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const DoublesPairProfile = lazy(() => import("./pages/DoublesPairProfile"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Glossary = lazy(() => import("./pages/Glossary"));
const HostTournament = lazy(() => import("./pages/HostTournament"));
const HostTournamentWizard = lazy(() => import("./pages/HostTournamentWizard"));

const TournamentAdmin = lazy(() => import("./pages/TournamentAdmin"));
const TournamentTeamHub = lazy(() => import("./pages/TournamentTeamHub"));
const JoinTeamByLink = lazy(() => import("./pages/JoinTeamByLink"));
const TournamentSetupChecklist = lazy(() => import("./pages/TournamentSetupChecklist"));

const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const OfficiatePage = lazy(() => import("./pages/OfficiatePage"));


const TvScoreboardIndex = lazy(() => import("@/pages/TvScoreboardIndex"));
const TvScoreboard = lazy(() => import("./pages/TvScoreboard"));
const TvDrawReveal = lazy(() => import("@/pages/TvDrawReveal"));
const TvNextUp = lazy(() => import("@/pages/TvNextUp"));
const BracketPredictPage = lazy(() => import("@/pages/BracketPredictPage"));
const VerifyCertificate = lazy(() => import("@/pages/VerifyCertificate"));
const RateTournamentPage = lazy(() => import("@/pages/RateTournamentPage"));
const ObsOverlayScoreboard = lazy(() => import("./pages/ObsOverlayScoreboard"));
const CameraBroadcast = lazy(() => import("./pages/CameraBroadcast"));

// Shown only when an app update is offered, so it loads on demand.
const UpdateDialog = lazy(() =>
  import("./components/layout/UpdateDialog").then((m) => ({ default: m.UpdateDialog })),
);
// Dev-only harness route: the branch is dropped from production builds, so the
// umpire engine and its store never reach the entry chunk.
const UmpireEngine = import.meta.env.DEV
  ? lazy(() => import("@/components/umpire/UmpireEngine").then((m) => ({ default: m.UmpireEngine })))
  : null;

/** Redirect targets for retired personal-mode URLs (stable for SectionRedirect). */
const toSettings = () => "/settings";
const toTrainingTab = () =>
  personalRedirectTarget(window.location.pathname.replace(/^.*?(?=\/player\/)/, "")) ?? "/";


function AppRoutes() {
  const [location] = useLocation();

  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <Suspense fallback={<PageSkeleton />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.split("/")[1] || "root"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full"
          >
            <Switch>
              <Route path="/" component={Home} />
          {/* Pulse and Legacy were retired in the nav regroup (Home · Tournaments · Players · Club).
              Old links still land: see lib/sectionRedirects. Tournament-scoped Pulse links first. */}
          <Route path="/pulse">
            <LegacyPulseRedirect>
              <SectionRedirect to={pulseRedirectTarget} />
            </LegacyPulseRedirect>
          </Route>
          <Route path="/legacy">
            <SectionRedirect to={legacyRedirectTarget} />
          </Route>
          <Route path="/players" component={Players} />
          
          <Route path="/tv" component={TvScoreboardIndex} />
          <Route path="/tv/draw/:tournamentId?" component={TvDrawReveal} />
          <Route path="/tv/next/:tournamentId" component={TvNextUp} />
          <Route path="/predict/:tournamentId" component={BracketPredictPage} />
          <Route path="/rate/:tournamentId" component={RateTournamentPage} />
          <Route path="/tv/overlay/:matchId?" component={ObsOverlayScoreboard} />
          <Route path="/tv/camera/:matchId?">
            <ProtectedRoute>
              <CameraBroadcast />
            </ProtectedRoute>
          </Route>
          <Route path="/tv/:matchId" component={TvScoreboard} />

          {/* Club gates its own tabs: About and Gallery are public, the rest members-only. */}
          <Route path="/club" component={Hub} />
          {/* Back-compat: old /hub links (push notifications, bookmarks) → /club, preserving tab/hash */}
          <Route path="/hub" component={() => { window.location.replace(`${import.meta.env.BASE_URL}club${window.location.search}${window.location.hash}`); return null; }} />
          <Route path="/hall-of-fame" component={() => { window.location.href=`${import.meta.env.BASE_URL}players?tab=champions`; return null; }} />
          <Route path="/gallery" component={() => { window.location.href=`${import.meta.env.BASE_URL}club?tab=gallery#albums`; return null; }} />
          <Route path="/events/:slug" component={TournamentDetail} />
          <Route path="/tournaments" component={TournamentsHub} />
          {/* WP5 canonical routes — docs/decisions/wp5-canonical-routes.md */}
          <Route path="/tournaments/:id/matches/:matchId/:mtab?" component={TournamentMatchPage} />
          <Route path="/tournaments/:id/venue" component={VenueScoreboardPage} />
          <Route path="/tournaments/:id/scoreboard" component={VenueScoreboardPage} />
          <Route path="/tournaments/:id/:tab?" component={TournamentPage} />
          <Route path="/matches/:matchId" component={MatchShortRedirect} />
          <Route path="/team-hub/:id">
            <ProtectedRoute>
              <ErrorBoundary fallback={<PageErrorFallback />}>
                <TournamentTeamHub />
              </ErrorBoundary>
            </ProtectedRoute>
          </Route>
          <Route path="/join-team/:token">
            <ErrorBoundary fallback={<PageErrorFallback />}>
              <JoinTeamByLink />
            </ErrorBoundary>
          </Route>
          <Route path="/tournament-setup/:id">
            <ProtectedRoute>
              <ErrorBoundary fallback={<PageErrorFallback />}>
                <TournamentSetupChecklist />
              </ErrorBoundary>
            </ProtectedRoute>
          </Route>
          <Route path="/join" component={Join} />
          <Route path="/auth" component={() => {
            window.location.replace(`${import.meta.env.BASE_URL}join${window.location.search}${window.location.hash}`);
            return null;
          }} />
          <Route path="/player/:id">
            <GuestGate feature="Player Profile">
              <ErrorBoundary fallback={<PageErrorFallback />}>
                <PlayerProfile />
              </ErrorBoundary>
            </GuestGate>
          </Route>
          {/* Personal Space folded into the profile's Training tab (lib/sectionRedirects). */}
          <Route path="/player/:id/personal/*?">
            <SectionRedirect to={toTrainingTab} />
          </Route>
          <Route path="/h2h">
            <GuestGate feature="Head-to-head">
              <ErrorBoundary fallback={<PageErrorFallback />}>
                <HeadToHeadPage />
              </ErrorBoundary>
            </GuestGate>
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
          <Route path="/marketplace" component={() => { window.location.href=`${import.meta.env.BASE_URL}club?tab=market&sub=buy-sell`; return null; }} />
          <Route path="/exchange" component={() => { window.location.href=`${import.meta.env.BASE_URL}club?tab=market&sub=buy-sell`; return null; }} />
          <Route path="/find-lost" component={() => { window.location.href=`${import.meta.env.BASE_URL}club?tab=market&sub=lost-found`; return null; }} />
          <Route path="/umpire" component={OfficiatePage} />
          <Route path="/officiate" component={OfficiatePage} />
          <Route path="/feed/announcements" component={() => { window.location.href=`${import.meta.env.BASE_URL}club?tab=news`; return null; }} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsOfService} />
          <Route path="/glossary" component={Glossary} />
          <Route path="/verify/:code?" component={VerifyCertificate} />
          <Route path="/host-tournament" component={HostTournament} />
          <Route path="/host-tournament/new" component={HostTournamentWizard} />
          <Route path="/login-callback" component={() => {
            const [, setLoc] = useLocation();
            const { session, isInitializing } = useAuth();
            useEffect(() => { 
              if (!isInitializing) {
                // If we have a session, go home. If not, go to join.
                setLoc(session ? "/" : "/join"); 
              }
            }, [setLoc, session, isInitializing]);
            
            return (
              <div className="min-h-screen flex items-center justify-center bg-card text-foreground">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                  <p className="text-sm font-medium animate-pulse">Verifying login...</p>
                </div>
              </div>
            );
          }} />

          <Route path="/admin"><ProtectedRoute><SiteAdmin /></ProtectedRoute></Route>
          <Route path="/tournament-admin"><ProtectedRoute><TournamentAdmin /></ProtectedRoute></Route>
          <Route path="/profile/setup"><ProtectedRoute><ProfileSetup /></ProtectedRoute></Route>
          <Route path="/profile/subscriptions"><ProtectedRoute><SubscriptionsPage /></ProtectedRoute></Route>
          <Route path="/settings"><ProtectedRoute><SettingsPage /></ProtectedRoute></Route>
          
          <Route path="/my-matches"><ProtectedRoute><MyMatchesPage /></ProtectedRoute></Route>
          <Route path="/standings" component={TournamentStandingsPage} />

          <Route path="/player/:id/edit"><ProtectedRoute><ProfileSetup /></ProtectedRoute></Route>
          <Route path="/profile/password"><ProtectedRoute><ChangePassword /></ProtectedRoute></Route>
          <Route path="/delete-account"><ProtectedRoute><DeleteAccount /></ProtectedRoute></Route>

          {/* The old /personal account page duplicated Settings; its links land there. */}
          <Route path="/personal"><SectionRedirect to={toSettings} /></Route>
          <Route path="/personal/me"><SectionRedirect to={toSettings} /></Route>
          <Route path="/personal/player/:id" component={({ params }: { params: { id: string } }) => {
            window.location.replace(`${import.meta.env.BASE_URL}player/${encodeURIComponent(params.id)}`);
            return null;
          }} />

          {/* Test route is excluded from production builds. */}
          {import.meta.env.DEV && UmpireEngine && <Route path="/test-umpire-engine" component={() => (
             <UmpireEngine 
               initialMatchState={{
                 id: "test-match-123",
                 umpireId: "test-user-123",
                 umpireName: "Test Umpire",
                 isFriendly: true,
                 status: "playing",
                 t1: { p1Id: "test-player-1", p1Name: "P1", score: 0, games: 0 },
                 t2: { p1Id: "test-player-2", p1Name: "P2", score: 0, games: 0 },
                 serverTeam: 1,
                 serverPlayerIndex: 0,
                 receiverPlayerIndex: 0,
                 t1LastServedBy: 0,
                 t2LastServedBy: 0,
                 endsSwapped: false,
                 bestOfSets: 3,
                 pointsToWin: 21,
                 goldenPoint: 30,
                 category: "MS",
                 pointLog: [],
                 setsHistory: [],
               }}
               userId="test-user-123"
               userName="Test Umpire"
               userEmail="test@test.com"
               onClose={() => {}}
             />
          )} />}

          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </ErrorBoundary>
  );
}

// GuestPromoBanner removed to prevent status bar bleeding and UX confusion

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
      className="fixed top-0 inset-x-0 z-[9998] flex items-center justify-center gap-2 bg-muted text-foreground text-sm font-bold py-2 px-4 shadow-lg"
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
  const { updateInfo, isDialogOpen, dismissUpdate, skipUpdate } = useAppUpdate();
  const { session } = useAuth();
  const [location, setLocation] = useLocation();

  useInactivityLogout();
  useNativeBackButton();
  useNotificationDeepLinks();
  usePullToRefresh();
  useOverflowGuard();
  useTopTenAlert();

  // Open the exact page behind a shared link (Android App Links), QR code,
  // NFC tag or the Quick Settings tile. Capacitor also re-delivers the launch
  // URL through appUrlOpen on a cold start, so one listener covers both.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleDeepLink = (event: { url?: string }) => {
      const url = event?.url;
      if (!url) return;
      const path = appPathFromUrl(url);
      if (!path) return;

      // CRITICAL: Feed OAuth tokens to Supabase before routing
      if (url.includes("#access_token=") && /^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/.test(url.slice(url.indexOf("#")))) {
        window.location.hash = url.slice(url.indexOf("#"));
        supabase.auth.getSession();
      }

      setLocation(path);
    };

    let listenerHandle: { remove: () => void } | null = null;
    CapacitorApp.addListener("appUrlOpen", handleDeepLink).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      listenerHandle?.remove();
    };
  }, [setLocation]);



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
              <PageViewTracker />
              <GlobalAuthGuard />
              {!location.startsWith("/tv") && <OnboardingTour />}
              <ScrollProgress />
              <div data-overflow-root className={`flex flex-col min-h-screen overflow-x-clip ${location.startsWith("/tv") ? "" : "pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0"}`}>
                {/* Skip-to-content for keyboard / screen-reader users */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:font-bold focus:shadow-lg"
                >
                  Skip to content
                </a>
                {!location.startsWith("/tv") && <OfflineBanner />}
                {!location.startsWith("/tv") && <PwaInstallPrompt />}
                {!location.startsWith("/tv") && <Navigation />}
                {!location.startsWith("/tv") && <StatusBanner />}
                <main id="main-content" className="flex-1 flex flex-col">
                  <AppRoutes />
                </main>
                {!location.startsWith("/tv") && <Footer />}
              </div>
              <BackToTop />
            </Router>
            <Toaster />
            {isDialogOpen && updateInfo && (
              // Empty-fragment fallback: ErrorBoundary treats null as "show the
              // full-page error"; a failed chunk fetch gets its reload-once path.
              <ErrorBoundary fallback={<></>}>
                <Suspense fallback={null}>
                  <UpdateDialog
                    info={updateInfo}
                    onDismiss={dismissUpdate}
                    onSkip={() => skipUpdate(updateInfo.promptToken)}
                  />
                </Suspense>
              </ErrorBoundary>
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
