import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence } from "framer-motion";
import { getTournaments } from "@/lib/tournaments";
import { fetchSiteData } from "@/lib/siteData";
import { Avatar } from "@/components/ui/Avatar";
// PersonalNavigation removed
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
  Globe,
  Plus,
  Lock,
  Search,
  Home,
  Activity,
  Users,
  Shield,
  Download,
  Trophy,
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Bell,
  BellRing,
  Calendar,
  AlertTriangle,
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
import { NotificationSettingsModal } from "@/components/profile/NotificationSettingsModal";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { HolidayCalendarModal } from "@/components/HolidayCalendarModal";
import { navGet } from "@/lib/navMemory";

/** Returns the best href to navigate to when tapping Pulse — restores last tab */
const getPulseHref = () => {
  const saved = navGet("pulse_tab");
  if (saved && ["live", "feed", "events", "directory"].includes(saved)) {
    return `/pulse#${saved}`;
  }
  return "/pulse";
};

const CLUB_LINKS = [
  { href: "/pulse", label: "Pulse" },
  { href: "/legacy", label: "Legacy" },
  { href: "/hub", label: "Hub" },
];

// ModeToggle removed

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [liveEventCount, setLiveEventCount] = useState(0);
  const [hasUnreadAnnouncements, setHasUnreadAnnouncements] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
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
  const { theme } = useTheme();
  const { viewAsRole, setViewAsRole, isMasterAdmin: isTrulyMainAdmin, profile } = useAuth();
  const { updateInfo, openUpdateDialog } = useAppUpdate();
  const { mode, setMode } = useAppMode();

  const currentLinks = CLUB_LINKS;

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 12);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mode logic simplified

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

  useEffect(() => {
    const openHolidays = () => setShowHolidays(true);
    window.addEventListener("openHolidays", openHolidays);
    return () => window.removeEventListener("openHolidays", openHolidays);
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
    // Mark announcements as read when user visits the pulse page
    if (location.startsWith("/pulse")) {
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
    const inviteUrl = "https://iiscshuttlers.github.io/IIScBadmintonClub/join";
    
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

  // We now want the global top navigation bar to render everywhere, including personal spaces.
  // The bottom navigation bar is still conditionally hidden below for personal spaces.

  return (
    <>
      <nav
        style={{ paddingTop: 'max(env(safe-area-inset-top), 24px)' }}
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-gradient-to-r from-primary/10 to-white/95 dark:from-primary/40 dark:to-slate-950/95 backdrop-blur-xl shadow-lg shadow-primary/20 dark:shadow-slate-900/40 border-b border-primary/30 dark:border-slate-800/60"
            : "bg-gradient-to-r from-primary/10 to-white dark:from-primary/20 dark:to-slate-950 border-b border-transparent"
        }`}
      >
        <div className={`container mx-auto px-4 transition-all duration-300 ${scrolled ? "py-1.5" : "py-2"}`}>

          {/* ── Row 1: Logo + Nav Links ─────────────────────────────── */}
          <div className="flex items-center gap-2">
            <Link href="/" className="min-w-0 flex-shrink">
              <div className="flex items-center gap-1.5 sm:gap-2 cursor-pointer min-w-0">
                <img
                  src={`${import.meta.env.BASE_URL}iisc-logo.png`}
                  alt="IISc Logo"
                  className="w-8 h-8 sm:w-9 sm:h-9 object-contain flex-shrink-0 transition-all duration-300"
                />
                <div className="min-w-0 flex-shrink flex-1 pr-1">
                  <span className="font-bold text-foreground dark:text-foreground leading-tight text-xs sm:text-base block truncate tracking-tight">
                    IISc Badminton Club
                  </span>
                  {viewAsRole ? (
                    <span className="text-[9px] text-amber-500 font-black uppercase tracking-widest hidden sm:block animate-pulse truncate">
                      Viewing as: {viewAsRole.replace("_", " ")}
                    </span>
                  ) : (
                    <span className="text-[9px] text-primary dark:text-primary font-semibold uppercase tracking-widest hidden sm:block truncate">
                      Shuttlers · Bangalore
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">

              <NavLink href="/" label="Home" isActive={isActive("/")} />
              {currentLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href === "/pulse" ? getPulseHref() : link.href}
                  label={link.label}
                  isActive={isActive(link.href)}
                  badge={link.href === "/pulse" ? (liveEventCount > 0 ? liveEventCount : (hasUnreadAnnouncements ? -1 : undefined)) : undefined}
                />
              ))}
            </div>

            {/* Mobile action buttons (search + profile) — always visible on mobile */}
            <div className="flex lg:hidden items-center gap-0.5 ml-auto flex-shrink-0">
              <button
                onClick={() => setShowHolidays(true)}
                className="p-1.5 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 transition-colors shadow-sm border border-emerald-100 dark:border-emerald-900/50"
                aria-label="Holiday Calendar"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 rounded-xl text-muted-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
              {!authLoading && (
                isLoggedIn ? (
                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <button
                        onClick={() => setLocation("/admin")}
                        className="p-1.5 rounded-xl text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                        title="Site Admin"
                      >
                        <Shield className="w-4.5 h-4.5" />
                      </button>
                    )}
                    {profile && <NotificationsMenu currentUser={profile} />}

                    {Capacitor.isNativePlatform() ? (
                      <button
                        onClick={() => {
                          if (myPlayerId) {
                            setLocation(`/player/${myPlayerId}/personal`);
                          } else {
                            toast.info("Please set up your profile to access your Personal Space.", {
                              action: {
                                label: "Set Up Profile",
                                onClick: () => setLocation("/profile/setup"),
                              },
                              duration: 6000,
                            });
                            setLocation("/profile/setup");
                          }
                        }}
                        className="hover:opacity-80 transition-opacity outline-none ring-2 ring-primary/50 rounded-full"
                      >
                        <Avatar src={userAvatar} name={userName} size="xs" />
                      </button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="hover:opacity-80 transition-opacity outline-none">
                            <Avatar src={userAvatar} name={userName} size="xs" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 mt-2">
                          {myPlayerId ? (
                            <>
                              <DropdownMenuItem onClick={() => setLocation(`/player/${myPlayerId}`)} className="cursor-pointer font-bold text-amber-600 dark:text-amber-500">
                                <UserCircle className="mr-2 h-4 w-4" />
                                <span>Public Profile</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                              </DropdownMenuItem>
                            </>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleSignOut()} className="cursor-pointer text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Sign Out</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ) : (
                  <div onClick={() => {
                    sessionStorage.setItem("return_url", location + window.location.search + window.location.hash);
                    setLocation("/join");
                  }} className="cursor-pointer">
                    <Button className="flex items-center gap-1.5 bg-primary hover:bg-primary text-primary-foreground font-bold text-xs px-3 rounded-full h-8 shadow-sm cursor-pointer pointer-events-none">
                      <LogIn className="w-3.5 h-3.5" /> Sign In
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ── Row 2: Action Buttons — desktop only ─────────────────── */}
          <div className="hidden lg:flex items-center justify-end gap-1.5 mt-1 border-t border-slate-100 dark:border-slate-800/60 pt-1.5">

            <button
              onClick={() => setShowHolidays(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 transition-colors shadow-sm border border-emerald-100 dark:border-emerald-900/50"
              aria-label="Holiday Calendar"
            >
              <Calendar className="w-3.5 h-3.5" />
              Holidays
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded-xl text-muted-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            {!authLoading && (
              isLoggedIn ? (
                <div className="flex items-center gap-3 ml-2 border-l border-slate-200 dark:border-slate-800 pl-3">
                  {isAdmin && (
                    <button
                      onClick={() => setLocation("/admin")}
                      className="p-1.5 rounded-xl text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                      title="Site Admin"
                    >
                      <Shield className="w-5 h-5" />
                    </button>
                  )}
                  {profile && <NotificationsMenu currentUser={profile} />}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="hover:opacity-80 transition-opacity outline-none">
                          <Avatar src={userAvatar} name={userName} size="sm" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 mt-2">
                        {myPlayerId ? (
                          <>
                            <DropdownMenuItem onClick={() => setLocation(`/player/${myPlayerId}`)} className="cursor-pointer font-bold text-amber-600 dark:text-amber-500">
                              <UserCircle className="mr-2 h-4 w-4" />
                              <span>Public Profile</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/player/${myPlayerId}/personal`)} className="cursor-pointer font-bold text-primary">
                              <User className="mr-2 h-4 w-4" />
                              <span>Personal Space</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                              <Settings className="mr-2 h-4 w-4" />
                              <span>Settings</span>
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleSignOut()} className="cursor-pointer text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30">
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Sign Out</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              ) : (

                <div className="cursor-pointer" onClick={() => {
                  sessionStorage.setItem("return_url", location + window.location.search + window.location.hash);
                  setLocation("/join");
                }}>
                  <Button className="flex items-center gap-1.5 bg-primary hover:bg-primary text-primary-foreground font-bold text-xs px-3 rounded-full h-7 shadow-sm cursor-pointer pointer-events-none">
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

              <div className="pt-2 mt-2">



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


                    {myPlayerId && (
                      <>
                        <button
                          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer"
                          onClick={() => {
                            setIsOpen(false);
                            setLocation(`/player/${myPlayerId}`);
                          }}
                        >
                          <UserCircle className="h-4 w-4 text-amber-500" /> Public Profile
                        </button>
                        <button
                          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-primary font-bold text-sm transition-colors cursor-pointer"
                          onClick={() => {
                            setIsOpen(false);
                            setLocation(`/player/${myPlayerId}/personal`);
                          }}
                        >
                          <User className="h-4 w-4" /> Personal Space
                        </button>
                        <button
                          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors cursor-pointer"
                          onClick={() => {
                            setIsOpen(false);
                            setLocation("/settings");
                          }}
                        >
                          <Settings className="h-4 w-4" /> Settings
                        </button>
                      </>
                    )}
                    <button
                      className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 font-medium text-sm transition-colors cursor-pointer"
                      onClick={() => {
                        setIsOpen(false);
                        handleSignOut();
                      }}
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                ) : (
                  <div onClick={() => {
                    sessionStorage.setItem("return_url", location + window.location.search + window.location.hash);
                    setIsOpen(false);
                    setLocation("/join");
                  }} className="w-full">
                    <Button className="w-full flex items-center gap-2 justify-center bg-primary hover:bg-primary text-primary-foreground font-bold rounded-xl h-11 cursor-pointer mt-1">
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
      {!new RegExp('^/player/[^/]+/personal').test(location) && (
      <div
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999] bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex justify-around items-end px-1 pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      >
                <Link href="/" className="flex-1 min-w-0">
                  <button className={`relative flex flex-col items-center w-full pt-2 pb-1 px-0.5 ${isActive("/") ? "text-[#ccff00]" : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}>
                    <LayoutDashboard strokeWidth={1.5} className="w-5 h-5 mb-0.5" />
                    <span className="text-[11px] font-semibold">Home</span>
                  </button>
                </Link>
                <a href={getPulseHref()} className="flex-1 min-w-0">
                  <button className={`relative flex flex-col items-center w-full pt-2 pb-1 px-0.5 ${isActive("/pulse") ? "text-[#ccff00]" : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}>
                    <Activity strokeWidth={1.5} className="w-5 h-5 mb-0.5" />
                    <span className="text-[11px] font-semibold">Pulse</span>
                    {hasUnreadAnnouncements && (
                      <span title="New announcements" className="absolute top-1 right-1.5 flex items-center justify-center">
                        <span className="w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-950" />
                      </span>
                    )}
                  </button>
                </a>





              <Link href="/hub" className="flex-1 min-w-0">
                <button className={`relative flex flex-col items-center w-full pt-2 pb-1 px-0.5 ${isActive("/hub") ? "text-[#ccff00]" : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}>
                  <Globe strokeWidth={1.5} className="w-5 h-5 mb-0.5" />
                  <span className="text-[11px] font-semibold">Hub</span>
                </button>
              </Link>
              
              <Link href="/legacy" className="flex-1 min-w-0">
                <button className={`relative flex flex-col items-center w-full pt-2 pb-1 px-0.5 ${isActive("/legacy") ? "text-[#ccff00]" : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}>
                  <Trophy strokeWidth={1.5} className="w-5 h-5 mb-0.5" />
                  <span className="text-[11px] font-semibold">Legacy</span>
                </button>
              </Link>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`relative flex-1 min-w-0 flex flex-col items-center pt-2 pb-1 px-0.5 cursor-pointer ${isOpen ? (mode === 'club' ? "text-primary dark:text-primary" : "text-blue-600 dark:text-blue-400") : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"}`}
            >
              {isOpen ? <X className="w-5 h-5 mb-0.5" /> : <Menu className="w-5 h-5 mb-0.5" />}
              <span className="text-[11px] font-semibold">Menu</span>
            </button>
          </div>
      )}


      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
      />

      <NotificationSettingsModal
        open={isNotificationSettingsOpen}
        onOpenChange={setIsNotificationSettingsOpen}
      />

      <ConfirmDialog
        open={signOutDialog.open}
        title="Sign Out"
        description={signOutDialog.message}
        confirmLabel="Sign Out"
        confirmVariant="danger"
        onConfirm={() => { setSignOutDialog(d => ({ ...d, open: false })); signOutDialog.onConfirm(); }}
        onCancel={() => setSignOutDialog(d => ({ ...d, open: false }))}
      />
      <AnimatePresence>
        {showHolidays && <HolidayCalendarModal onClose={() => setShowHolidays(false)} />}
      </AnimatePresence>
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
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-on-accent px-0.5 shadow ring-2 ring-white dark:ring-slate-950">
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

