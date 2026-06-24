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
import { useBroadcastNotification } from "./hooks/useBroadcastNotification";
import { usePingsNotification } from "./hooks/usePingsNotification";
import { initSounds } from "./lib/sounds";
import { OnboardingTour } from "./components/OnboardingTour";

import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";

function UpdateDialog({
  info,
  onDismiss,
}: {
  info: AppUpdateInfo;
  onDismiss: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadAndInstall = async () => {
    // If it's a Play Store link, open it natively and skip APK downloading
    if (info.downloadUrl.includes("play.google.com") || info.downloadUrl.startsWith("market://")) {
      window.open(info.downloadUrl, "_system");
      onDismiss();
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      window.open(info.downloadUrl, "_blank");
      return;
    }

    try {
      setDownloading(true);
      const fileName = `IIScShuttlers_${info.versionName}.apk`;

      const downloadResult = await Filesystem.downloadFile({
        url: info.downloadUrl,
        path: fileName,
        directory: Directory.Cache,
      });

      if (downloadResult.path) {
        await FileOpener.open({
          filePath: downloadResult.path,
          contentType: "application/vnd.android.package-archive",
        });
      }
    } catch (error) {
      console.error("Download failed", error);
      // Fallback if filesystem plugin fails
      window.open(info.downloadUrl, "_system");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-7 space-y-5">
        <div className="text-center space-y-1">
          <div className="text-4xl mb-2">🏸</div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Update Available
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Version {info.versionName} is ready
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleDownloadAndInstall}
            disabled={downloading}
            className={`w-full ${downloading ? "bg-emerald-800" : "bg-emerald-600 hover:bg-emerald-700"} text-white font-bold py-3 rounded-xl text-center transition-colors`}
          >
            {downloading ? "Downloading..." : "Download Update"}
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

// NotFound is eagerly loaded (tiny, always needed as fallback)
import NotFound from "./pages/NotFound";

// All pages lazy-loaded for optimal bundle splitting
const Home = lazy(() => import("./pages/Home"));
const Feed = lazy(() => import("./pages/Feed"));
const Events = lazy(() => import("./pages/Events"));
const About = lazy(() => import("./pages/About"));
const Gallery = lazy(() => import("./pages/Gallery"));
const TournamentDetail = lazy(() => import("./pages/TournamentDetail"));


// TournamentAdmin merged into SiteAdmin — /tournament/admin redirects to /admin
const SiteAdmin = lazy(() => import("./pages/SiteAdmin"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const Join = lazy(() => import("./pages/Join"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const PlayersDirectory = lazy(() => import("./pages/PlayersDirectory"));
const ComparePlayers = lazy(() => import("./pages/ComparePlayers"));
const HallOfFame = lazy(() => import("./pages/HallOfFame"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));

const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const DoublesPairProfile = lazy(() => import("./pages/DoublesPairProfile"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Marketplace = lazy(() => import("./pages/Marketplace"));

// Save scroll position before navigating away, restore on back-navigation
const scrollMap = new Map<string, number>();

function ScrollToTop() {
  const [location] = useLocation();
  const prevLocation = useRef<string | null>(null);

  useEffect(() => {
    // Save scroll position for the previous route
    if (prevLocation.current && prevLocation.current !== location) {
      scrollMap.set(prevLocation.current, window.scrollY);
    }

    // Restore or reset
    const saved = scrollMap.get(location);
    if (saved !== undefined) {
      requestAnimationFrame(() => window.scrollTo(0, saved));
    } else {
      window.scrollTo(0, 0);
    }

    prevLocation.current = location;
  }, [location]);

  return null;
}

function PageSkeleton() {
  return (
    <div className="flex-1 w-full px-4 py-10 max-w-5xl mx-auto space-y-5">
      {/* Heading shimmer */}
      <div className="h-9 w-1/3 rounded-xl shimmer" />
      <div className="h-4 w-3/4 rounded shimmer" />
      <div className="h-4 w-1/2 rounded shimmer" />
      {/* Card row shimmer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-44 rounded-2xl shimmer" />
        ))}
      </div>
      {/* List shimmer */}
      <div className="space-y-3 mt-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-full flex-shrink-0 shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded shimmer" />
              <div className="h-3 w-1/3 rounded shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
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
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/feed" component={Feed} />
          <Route path="/feed/:tab" component={Feed} />
          <Route path="/about" component={About} />
          <Route path="/hall-of-fame" component={HallOfFame} />
          <Route path="/gallery" component={Gallery} />
          <Route path="/events/:slug" component={TournamentDetail} />
          <Route path="/events" component={Events} />
          <Route path="/join" component={Join} />
          <Route path="/player/:id" component={PlayerProfile} />
          <Route path="/compare/:p1/:p2" component={ComparePlayers} />
          <Route path="/doubles/:p1/:p2" component={DoublesPairProfile} />
          <Route path="/exchange" component={Marketplace} />
          <Route path="/marketplace" component={Marketplace} /> {/* Keep legacy for a bit just in case */}
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsOfService} />

          <Route path="/admin"><ProtectedRoute><SiteAdmin /></ProtectedRoute></Route>
          <Route path="/profile/setup"><ProtectedRoute><ProfileSetup /></ProtectedRoute></Route>
          <Route path="/players"><ProtectedRoute><PlayersDirectory /></ProtectedRoute></Route>
          <Route path="/player/:id/edit"><ProtectedRoute><ProfileSetup /></ProtectedRoute></Route>
          <Route path="/profile/password"><ProtectedRoute><ChangePassword /></ProtectedRoute></Route>
          <Route path="/find-lost"><ProtectedRoute><Marketplace /></ProtectedRoute></Route>
          <Route path="/delete-account"><ProtectedRoute><DeleteAccount /></ProtectedRoute></Route>

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
      className="fixed top-0 inset-x-0 z-[9998] flex items-center justify-center gap-2 bg-slate-800 text-white text-sm font-bold py-2 px-4 shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      You're offline — some features may be unavailable
    </div>
  );
}

function GlobalAuthHooks() {
  usePingsNotification();
  useBroadcastNotification();
  useEffect(() => { initSounds(); }, []);
  return null;
}

function AppContent() {
  const { updateInfo, isDialogOpen, dismissUpdate } = useAppUpdate();
  const [isLogMatchOpen, setIsLogMatchOpen] = useState(false);
  const [defaultOpponentId, setDefaultOpponentId] = useState<string | undefined>(undefined);
  const [otherPlayers, setOtherPlayers] = useState<any[]>([]);
  const { profile } = useAuth();
  const [, setLocation] = useLocation();

  useInactivityLogout();
  useNativeBackButton();
  usePullToRefresh();
  useOfflineSync();

  // Handle deep links from QR codes and NFC scans
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleDeepLink = (event: any) => {
      const url = event.url;
      if (url) {
        // Handle iiscshuttlers:// scheme
        if (url.startsWith("iiscshuttlers://")) {
          const path = url.slice("iiscshuttlers://".length);
          setLocation("/" + path);
          return;
        }
        // Handle https URLs
        if (url.includes("iiscbadmintonclub.github.io")) {
          const match = url.match(/iiscbadmintonclub\.github\.io\/iiscshuttlers(\/[^?]*)?/);
          if (match) {
            setLocation(match[1] || "/");
          }
        }
      }
    };

    CapacitorApp.addListener("appUrlOpen", handleDeepLink);

    // Clean up listeners on unmount
    return () => {
      CapacitorApp.removeAllListeners();
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

  useEffect(() => {
    if (!profile?.id) return;
    import("@/lib/supabase").then(({ supabase }) => {
      supabase
        .from("players")
        .select("id, full_name, avatar_url, gender, is_guest")
        .neq("id", profile.id)
        .is("deleted_at", null)
        .order("full_name")
        .then(({ data }) => {
          if (data) setOtherPlayers(data);
        });
    });
  }, [profile?.id]);

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
              <ScrollProgress />
              <div className="flex flex-col min-h-screen">
                {/* Skip-to-content for keyboard / screen-reader users */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-xl focus:font-bold focus:shadow-lg"
                >
                  Skip to content
                </a>
                <OfflineBanner />
                <PwaInstallPrompt />
                <Navigation />
                <StatusBanner />
                <main id="main-content" className="flex-1 flex flex-col pb-20 lg:pb-0">
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
                otherPlayers={otherPlayers}
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
      <ThemeProvider defaultTheme="light" switchable>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppUpdateProvider>
              <AppContent />
            </AppUpdateProvider>
          </AuthProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
