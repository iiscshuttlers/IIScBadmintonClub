import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { getTournaments } from "@/lib/tournaments";
import { fetchSiteData } from "@/lib/siteData";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import UserDropdown from "@/components/navigation/UserDropdown";
import { PersonalNavigation } from "@/components/PersonalNavigation";
import {
  Menu,
  X,
  UserCircle,
  LogIn,
  User,
  Settings,
  LogOut,
  UserPlus,
  Moon,
  Sun,
  Zap,
  ChevronDown,
  BookOpen,
  Plus,
  Lock,
  Search,
  Home,
  Activity,
  Users,
  Shield,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { useAuth, type ViewAsRole } from "@/contexts/AuthContext";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useAppMode } from "@/contexts/AppModeContext";
import { PreferencesModal } from "@/components/QuickSettings";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const CLUB_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/players", label: "Players" },
  { href: "/events", label: "Events" },
  { href: "/hall-of-fame", label: "Winners Wall" },
  { href: "/gallery", label: "Gallery" },
  { href: "/exchange", label: "Exchange" },
  { href: "/about", label: "Club" },
];

const PERSONAL_LINKS = [
  { href: "/my-feed", label: "My Matches" },
  { href: "/my-network", label: "My Network" },
  { href: "/my-stats", label: "My Stats" },
  { href: "/settings", label: "Settings" }
];

function ModeToggle({ isLoggedIn, setLocation, mode, setMode }: { isLoggedIn: boolean, setLocation: any, mode: 'club' | 'personal', setMode: any }) {
  const handleToggle = (newMode: 'club' | 'personal') => {
    if (newMode === 'personal' && !isLoggedIn) {
      sessionStorage.setItem("return_url", "/feed/my-matches");
      setLocation("/join");
      return;
    }
    setMode(newMode);
  };

  return (
    <div className="flex bg-slate-100 dark:bg-slate-900 rounded-full p-1 mr-2 shadow-inner border border-slate-200/60 dark:border-slate-800">
      <button
        onClick={() => handleToggle('club')}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${mode === 'club' ? 'bg-white dark:bg-slate-800 text-primary dark:text-primary shadow-sm' : 'text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300'}`}
      >
        <Users className="w-3.5 h-3.5" /> Club
      </button>
      <button
        onClick={() => handleToggle('personal')}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${mode === 'personal' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300'}`}
      >
        <User className="w-3.5 h-3.5" /> Personal
      </button>
    </div>
  );
}

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [liveEventCount, setLiveEventCount] = useState(0);
  const [hasUnreadAnnouncements, setHasUnreadAnnouncements] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [signOutDialog, setSignOutDialog] = useState<{ open: boolean; message: string; onConfirm: () => void }>({ open: false, message: "", onConfirm: () => {} });
  const {
    authLoading,
    isAdmin,
    isLoggedIn,
    myPlayerId,
    savedAccounts,
    signOut,
    switchAccount,
    userName,
    userEmail,
    userAvatar,
    pendingActionCount,
  } = useNavigationAuth();
  const { theme, toggleTheme } = useTheme();
  const { viewAsRole, setViewAsRole, isMasterAdmin: isTrulyMainAdmin } = useAuth();
  const { updateInfo, openUpdateDialog } = useAppUpdate();
  const { mode, setMode } = useAppMode();

  const currentLinks = mode === "club" ? CLUB_LINKS : PERSONAL_LINKS;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Global Ctrl+K / Cmd+K keyboard shortcut to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fetch live event count once on mount (lightweight, fire-and-forget)
  useEffect(() => {
    getTournaments()
      .then((data: any[]) => {
        const count = data.filter((e: any) => e.status === "live").length;
        setLiveEventCount(count);
      })
      .catch(() => {});
  }, []);


  useEffect(() => {
    setIsOpen(false);
    // Mark announcements as read when user visits the feed page
    if (location.startsWith("/feed")) {
      localStorage.setItem("iisc_announcements_last_seen", Date.now().toString());
      setHasUnreadAnnouncements(false);
    }
  }, [location]);

  // Show unread dot if there are new announcements since last visit
  useEffect(() => {
    const check = async () => {
      const lastSeenStr = localStorage.getItem("iisc_announcements_last_seen");
      const lastSeen = lastSeenStr ? parseInt(lastSeenStr, 10) : 0;
      try {
        const data = await fetchSiteData<{ recent: any[] }>("announcements", "announcements.json");
        if (data && data.recent && data.recent.length > 0) {
          const latestItem = data.recent.reduce((latest, current) => {
            if (!latest.date) return current;
            if (!current.date) return latest;
            return new Date(current.date).getTime() > new Date(latest.date).getTime() ? current : latest;
          });
          
          if (latestItem && latestItem.date) {
            const latestTime = new Date(latestItem.date).getTime();
            setHasUnreadAnnouncements(latestTime > lastSeen);
          }
        }
      } catch (err) {
        // Silently fail if we can't load announcements for the nav dot
      }
    };
    check();
    window.addEventListener("announcements-read", check);
    return () => window.removeEventListener("announcements-read", check);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const handleSignOut = (message = "Are you sure you want to sign out of all accounts?") => {
    setSignOutDialog({
      open: true,
      message,
      onConfirm: async () => {
        setIsOpen(false);
        await signOut();
      },
    });
  };

  const handleInvite = async () => {
    const inviteText = "Join me on IISc Badminton Club! The ultimate platform for badminton tracking.";
    const inviteUrl = "https://iiscshuttlers.github.io/iiscshuttlers/join";
    
    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: "Join IISc Badminton Club",
        text: inviteText,
        url: inviteUrl,
        dialogTitle: "Invite Friends",
      });
    } else if (navigator.share) {
      await navigator.share({
        title: "Join IISc Badminton Club",
        text: inviteText,
        url: inviteUrl,
      });
    } else {
      await navigator.clipboard.writeText(`${inviteText} ${inviteUrl}`);
      toast.success("Invite link copied to clipboard!");
    }
    setIsOpen(false);
  };

  // Render Personal mode navigation if in Personal mode
  if (mode === "personal" && isLoggedIn) {
    return <PersonalNavigation />;
  }

  return (
    <>
      <nav
        className={`pt-[max(env(safe-area-inset-top),36px)] md:pt-[max(env(safe-area-inset-top),16px)] sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-gradient-to-r from-primary/10 to-white/95 dark:from-primary/40 dark:to-slate-950/95 backdrop-blur-xl shadow-lg shadow-primary/20 dark:shadow-slate-900/40 border-b border-primary/30 dark:border-slate-800/60"
            : "bg-gradient-to-r from-primary/10 to-white dark:from-primary/20 dark:to-slate-950 border-b border-transparent"
        }`}
      >
        <div className={`container mx-auto px-4 transition-all duration-300 ${scrolled ? "py-1.5" : "py-2"}`}>

          {/* ── Row 1: Logo + Nav Links ─────────────────────────────── */}
          <div className="flex items-center gap-2">
            <Link href="/">
              <div className="flex items-center gap-2.5 cursor-pointer flex-shrink-0">
                <img
                  src={`${import.meta.env.BASE_URL}iisc-logo.png`}
                  alt="IISc Logo"
                  className={`w-auto object-contain flex-shrink-0 transition-all duration-300 ${
                    scrolled ? "h-7 sm:h-8" : "h-9 sm:h-10"
                  }`}
                />
                <div>
                  <span className="font-bold text-foreground dark:text-foreground leading-tight text-sm sm:text-base block whitespace-nowrap tracking-tight">
                    IISc Badminton Club
                  </span>
                  {viewAsRole ? (
                    <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest hidden sm:block animate-pulse">
                      Viewing as: {viewAsRole.replace("_", " ")}
                    </span>
                  ) : (
                    <span className="text-[10px] text-primary dark:text-primary font-semibold uppercase tracking-widest hidden sm:block">
                      Shuttlers · Bangalore
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              <ModeToggle isLoggedIn={isLoggedIn} setLocation={setLocation} mode={mode} setMode={setMode} />
              <NavLink href="/" label="Home" isActive={isActive("/")} />
              {currentLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  isActive={isActive(link.href)}
                  badge={link.href === "/events" ? liveEventCount : link.href === "/feed" && hasUnreadAnnouncements ? -1 : undefined}
                />
              ))}
            </div>

            {/* Mobile action buttons (search + profile) — always visible on mobile */}
            <div className="flex lg:hidden items-center gap-1.5 ml-auto flex-shrink-0">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-xl text-muted-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Search"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
              {isLoggedIn && myPlayerId && (
                <NotificationsMenu currentUser={{ id: myPlayerId }} />
              )}
              {!authLoading && (
                isLoggedIn ? (
                  <UserDropdown
                    userAvatar={userAvatar}
                    userName={userName}
                    userEmail={userEmail}
                    myPlayerId={myPlayerId}
                    pendingActionCount={pendingActionCount}
                    isAdmin={isAdmin}
                    savedAccounts={savedAccounts}
                    switchAccount={switchAccount}
                    handleSignOut={handleSignOut}
                    handleInvite={handleInvite}
                  />
                ) : (
                  <div onClick={() => {
                    sessionStorage.setItem("return_url", window.location.pathname + window.location.search + window.location.hash);
                    setLocation("/join");
                  }} className="cursor-pointer">
                    <Button className="flex items-center gap-1.5 bg-primary hover:bg-primary text-foreground font-bold text-xs px-3 rounded-full h-8 shadow-sm cursor-pointer pointer-events-none">
                      <LogIn className="w-3.5 h-3.5" /> Sign In
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ── Row 2: Action Buttons — desktop only ─────────────────── */}
          <div className="hidden lg:flex items-center justify-end gap-1.5 mt-1 border-t border-slate-100 dark:border-slate-800/60 pt-1.5">
            {isLoggedIn && (
              <Button
                onClick={() => window.dispatchEvent(new Event('openLogMatchModal'))}
                className="bg-blue-600 hover:bg-blue-700 text-foreground font-bold text-xs px-3 rounded-full h-7 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Log Match
              </Button>
            )}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded-xl text-muted-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            {isLoggedIn && myPlayerId && (
              <NotificationsMenu currentUser={{ id: myPlayerId }} />
            )}
            {!authLoading && (
              isLoggedIn ? (
                <UserDropdown
                  userAvatar={userAvatar}
                  userName={userName}
                  userEmail={userEmail}
                  myPlayerId={myPlayerId}
                  pendingActionCount={pendingActionCount}
                  isAdmin={isAdmin}
                  savedAccounts={savedAccounts}
                  switchAccount={switchAccount}
                  handleSignOut={handleSignOut}
                  handleInvite={handleInvite}
                />
              ) : (

                <div className="cursor-pointer" onClick={() => {
                  sessionStorage.setItem("return_url", window.location.pathname + window.location.search + window.location.hash);
                  setLocation("/join");
                }}>
                  <Button className="flex items-center gap-1.5 bg-primary hover:bg-primary text-foreground font-bold text-xs px-3 rounded-full h-7 shadow-sm cursor-pointer pointer-events-none">
                    <LogIn className="w-3.5 h-3.5" /> Sign In
                  </Button>
                </div>
              )
            )}
          </div>

        </div>

        </nav>

      {/* ── Mobile Bottom Sheet Menu (outside nav so backdrop-blur doesn't break fixed positioning) ── */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div
            className="fixed bottom-[72px] left-2 right-2 bg-white dark:bg-slate-950 rounded-3xl shadow-2xl overflow-y-auto border border-slate-200 dark:border-slate-800 max-h-[calc(100vh-88px)]"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="px-4 py-4 space-y-1">
                <div className="w-10 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-4" />
                {currentLinks.filter(l => l.href !== "/feed" && l.href !== "/players").map((link) => (
                  <MobileNavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    badge={link.href === "/events" ? liveEventCount : undefined}
                    isActive={isActive(link.href)}
                    onClick={() => setIsOpen(false)}
                  />
                ))}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">

                {/* ── Light / Dark toggle — always visible ── */}
                <div className="mb-3 flex bg-slate-100 dark:bg-slate-900 rounded-2xl p-1.5 gap-1.5 border border-slate-200/60 dark:border-slate-800">
                  <button
                    onClick={() => { if (theme === "dark") toggleTheme(); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      theme === "light"
                        ? "bg-white shadow-sm text-amber-600 border border-amber-200/60"
                        : "text-muted-foreground dark:text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-200"
                    }`}
                  >
                    <Sun className="w-4 h-4" /> Light
                  </button>
                  <button
                    onClick={() => { if (theme === "light") toggleTheme(); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      theme === "dark"
                        ? "bg-slate-800 shadow-sm text-indigo-300 border border-indigo-800/60"
                        : "text-muted-foreground hover:text-muted-foreground"
                    }`}
                  >
                    <Moon className="w-4 h-4" /> Dark
                  </button>
                </div>

                {updateInfo && (
                  <button
                    onClick={() => { openUpdateDialog(); setIsOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-3 mb-2 rounded-xl bg-primary/10 dark:bg-primary/30 hover:bg-primary/15 dark:hover:bg-primary/90/50 text-primary dark:text-primary font-bold text-sm transition-colors cursor-pointer border border-primary/40/60 dark:border-primary/50"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="h-4 w-4" /> Update Available
                    </span>
                    <span className="text-[11px] font-semibold opacity-80">v{updateInfo.versionName}</span>
                  </button>
                )}

                {authLoading ? (
                  <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ) : isLoggedIn ? (
                  <div className="space-y-0.5">
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl mb-2 overflow-hidden border border-slate-100 dark:border-slate-800">
                        <button className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800" onClick={() => { setIsOpen(false); setIsPreferencesOpen(true); }}>
                          <Settings className="h-4 w-4 text-muted-foreground" /> App Preferences
                        </button>
                        <Link href="/profile/setup" className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
                          <User className="h-4 w-4 text-muted-foreground" /> Edit Profile
                        </Link>
                        <Link href="/profile/password" className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
                          <Lock className="h-4 w-4 text-muted-foreground" /> Change Password
                        </Link>
                      </div>

                    {isAdmin && (
                      <Link href="/admin" className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-950/30 text-violet-600 font-medium text-sm transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
                        <Zap className="h-4 w-4" /> Site Admin
                      </Link>
                    )}
                    <button
                      className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer"
                      onClick={handleInvite}
                    >
                      <UserPlus className="h-4 w-4 text-primary" /> Invite Friends
                    </button>
                    <Link href="/privacy" className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
                      <Shield className="h-4 w-4 text-muted-foreground" /> Privacy Policy
                    </Link>
                    <button
                      className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 font-medium text-sm transition-colors cursor-pointer"
                      onClick={() => handleSignOut()}
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                ) : (
                  <div onClick={() => {
                    sessionStorage.setItem("return_url", window.location.pathname + window.location.search + window.location.hash);
                    setIsOpen(false);
                    setLocation("/join");
                  }} className="w-full">
                    <Button className="w-full flex items-center gap-2 justify-center bg-primary hover:bg-primary text-foreground font-bold rounded-xl h-11 cursor-pointer mt-1">
                      <LogIn className="w-4 h-4" /> Sign In to your account
                    </Button>
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>
        )}

      {/* ── Mobile Bottom Navigation Bar (outside nav to ensure fixed positioning) ─────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999] bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex justify-around items-end px-2 pb-safe pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
            {mode === 'club' ? (
              <>
                <Link href="/">
                  <button className={`relative flex flex-col items-center p-2 min-w-[60px] ${isActive("/") ? "text-primary dark:text-primary" : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}>
                    <Home className={`w-[22px] h-[22px] mb-1 ${isActive("/") ? "fill-primary/20" : ""}`} />
                    <span className="text-[10px] font-bold">Home</span>
                  </button>
                </Link>
                <Link href="/feed">
                  <button className={`relative flex flex-col items-center p-2 min-w-[60px] ${isActive("/feed") ? "text-primary dark:text-primary" : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}>
                    <Activity className={`w-[22px] h-[22px] mb-1 ${isActive("/feed") ? "fill-primary/20" : ""}`} />
                    <span className="text-[10px] font-bold">Feed</span>
                    {hasUnreadAnnouncements && (
                      <span title="New announcements" className="absolute top-1 right-2.5 flex items-center justify-center">
                        <span className="w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-950" />
                      </span>
                    )}
                  </button>
                </Link>
              </>
            ) : (
              <>
                <Link href={myPlayerId ? `/player/${myPlayerId}` : "/join"}>
                  <button className={`relative flex flex-col items-center p-2 min-w-[60px] ${(location.startsWith("/player/") && location.includes(myPlayerId!)) ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}>
                    <User className={`w-[22px] h-[22px] mb-1 ${(location.startsWith("/player/") && location.includes(myPlayerId!)) ? "fill-blue-600/20" : ""}`} />
                    <span className="text-[10px] font-bold">My Stats</span>
                  </button>
                </Link>
                <Link href="/feed/my-matches">
                  <button className={`relative flex flex-col items-center p-2 min-w-[60px] ${isActive("/feed/my-matches") ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}>
                    <Activity className={`w-[22px] h-[22px] mb-1 ${isActive("/feed/my-matches") ? "fill-blue-600/20" : ""}`} />
                    <span className="text-[10px] font-bold">My Feed</span>
                  </button>
                </Link>
              </>
            )}

            {/* Center Log Match FAB */}
            <div className="relative -top-5 mx-1">
              {isLoggedIn ? (
                <button
                  onClick={() => window.dispatchEvent(new Event('openLogMatchModal'))}
                  className={`w-[52px] h-[52px] ${mode === 'club' ? 'bg-gradient-to-tr from-primary to-teal-500 hover:from-primary hover:to-teal-400 shadow-primary/40' : 'bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 shadow-blue-500/40'} rounded-full flex items-center justify-center text-foreground shadow-xl border-4 border-white dark:border-slate-950 transition-transform active:scale-95 cursor-pointer`}
                >
                  <Plus className="w-6 h-6 stroke-[3]" />
                </button>
              ) : (
                <button onClick={() => {
                  sessionStorage.setItem("return_url", window.location.pathname + window.location.search + window.location.hash);
                  setLocation("/join");
                }} className="w-[52px] h-[52px] bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-foreground shadow-xl border-4 border-white dark:border-slate-950 transition-transform active:scale-95 cursor-pointer">
                  <LogIn className="w-5 h-5 ml-1" />
                </button>
              )}
            </div>

            {mode === 'club' ? (
              <Link href="/players">
                <button className={`relative flex flex-col items-center p-2 min-w-[60px] ${isActive("/players") ? "text-primary dark:text-primary" : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}>
                  <Users className={`w-[22px] h-[22px] mb-1 ${isActive("/players") ? "fill-primary/20" : ""}`} />
                  <span className="text-[10px] font-bold">Players</span>
                </button>
              </Link>
            ) : (
              <Link href="/players?tab=connections">
                <button className={`relative flex flex-col items-center p-2 min-w-[60px] ${isActive("/players") ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}>
                  <Users className={`w-[22px] h-[22px] mb-1 ${isActive("/players") ? "fill-blue-600/20" : ""}`} />
                  <span className="text-[10px] font-bold">Network</span>
                </button>
              </Link>
            )}

            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`relative flex flex-col items-center p-2 min-w-[60px] cursor-pointer ${isOpen ? (mode === 'club' ? "text-primary dark:text-primary" : "text-blue-600 dark:text-blue-400") : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}
            >
              {isOpen ? <X className="w-[22px] h-[22px] mb-1" /> : <Menu className="w-[22px] h-[22px] mb-1" />}
              <span className="text-[10px] font-bold">Menu</span>
            </button>
        </div>

      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />

      <ConfirmDialog
        open={signOutDialog.open}
        title="Sign Out"
        description={signOutDialog.message}
        confirmLabel="Sign Out"
        confirmVariant="danger"
        onConfirm={() => { setSignOutDialog(d => ({ ...d, open: false })); signOutDialog.onConfirm(); }}
        onCancel={() => setSignOutDialog(d => ({ ...d, open: false }))}
      />
    </>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function NavLink({ href, label, isActive, badge }: { href: string; label: string; isActive: boolean; badge?: number }) {
  return (
    <Link href={href}>
      <button
        className={`relative px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
          isActive
            ? "text-primary dark:text-primary bg-primary/10 dark:bg-primary/50"
            : "text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800/60"
        }`}
      >
        {label}
        {!!badge && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-foreground px-0.5 shadow ring-2 ring-white dark:ring-slate-950">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50" />
            {badge > 0 && <span className="relative">{badge}</span>}
          </span>
        )}
      </button>
    </Link>
  );
}

function MobileNavLink({
  href, label, isActive, onClick, badge,
}: { href: string; label: string; isActive: boolean; onClick: () => void; badge?: number }) {
  return (
    <Link href={href}>
      <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-150 cursor-pointer ${
          isActive
            ? "text-primary dark:text-primary bg-primary/10 dark:bg-primary/50"
            : "text-muted-foreground dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
        }`}
      >
        <span>{label}</span>
        {!!badge && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-black">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {badge > 0 ? `${badge} LIVE` : "NEW"}
          </span>
        )}
      </button>
    </Link>
  );
}

function DarkModeToggle({ insideMenu }: { insideMenu?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (insideMenu) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTheme(); }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold text-muted-foreground dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          Dark Mode
        </span>
        <div className={`w-8 h-4 rounded-full transition-colors relative ${isDark ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
          <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${isDark ? 'left-4.5' : 'left-0.5'}`} />
        </div>
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="text-muted-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
      title="Toggle dark mode"
    >
      {isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
}

