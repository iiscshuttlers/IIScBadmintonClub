import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getTournaments } from "@/lib/tournaments";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { QuickSettingsContent } from "@/components/QuickSettings";

const TOP_LEVEL_LINKS = [
  { href: "/events", label: "Events" },
  { href: "/feed", label: "Feed" },
  { href: "/players", label: "Players" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [liveEventCount, setLiveEventCount] = useState(0);
  const [hasUnreadAnnouncements, setHasUnreadAnnouncements] = useState(false);
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
    // Mark announcements as read when user visits the page
    if (location.startsWith("/feed") && location.includes("tab=announcements")) {
      localStorage.setItem("iisc_announcements_last_seen", Date.now().toString());
      setHasUnreadAnnouncements(false);
    }
  }, [location]);

  // Show unread dot if announcements haven't been viewed in the last 24h
  useEffect(() => {
    const check = () => {
      const lastSeen = localStorage.getItem("iisc_announcements_last_seen");
      if (!lastSeen) {
        setHasUnreadAnnouncements(true);
      } else {
        const elapsed = Date.now() - parseInt(lastSeen, 10);
        setHasUnreadAnnouncements(elapsed > 24 * 60 * 60 * 1000);
      }
    };
    check();
    window.addEventListener("announcements-read", check);
    return () => window.removeEventListener("announcements-read", check);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const handleSignOut = async (
    message = "Are you sure you want to sign out of all accounts?"
  ) => {
    if (!confirm(message)) return;
    setIsOpen(false);
    await signOut();
  };

  return (
    <>
      {/* Top gradient accent bar */}
      <div className="h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-orange-500" />

      <nav
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/92 dark:bg-slate-950/92 backdrop-blur-xl shadow-lg shadow-slate-200/40 dark:shadow-slate-900/40 border-b border-slate-100/80 dark:border-slate-800/60"
            : "bg-white dark:bg-slate-950 border-b border-transparent"
        }`}
      >
        <div className={`container mx-auto px-4 transition-all duration-300 ${scrolled ? "py-2" : "py-3"}`}>
          <div className="flex justify-between items-center gap-4">

            {/* ── Logo ─────────────────────────────── */}
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer min-w-0 flex-shrink-0">
                <img
                  src={`${import.meta.env.BASE_URL}iisc-logo.png`}
                  alt="IISc Logo"
                  className={`w-auto object-contain flex-shrink-0 transition-all duration-300 ${
                    scrolled ? "h-8 sm:h-9" : "h-10 sm:h-11"
                  }`}
                />
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 dark:text-white leading-tight text-base sm:text-lg block truncate tracking-tight">
                    IISc Badminton Club
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-widest hidden sm:block">
                    Shuttlers · Bangalore
                  </span>
                </div>
              </div>
            </Link>

            {/* ── Desktop Nav Links ─────────────────── */}
            <div className="hidden lg:flex items-center gap-0.5">
              <NavLink href="/" label="Home" isActive={isActive("/")} />
              {TOP_LEVEL_LINKS.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  isActive={isActive(link.href)}
                  badge={link.href === "/events" ? liveEventCount : link.href === "/feed" && hasUnreadAnnouncements ? -1 : undefined}
                />
              ))}
            </div>

            {/* ── Desktop Right Controls ────────────── */}
            <div className="hidden lg:flex items-center gap-2">
              {isLoggedIn && (
                <Button
                  onClick={() => window.dispatchEvent(new Event('open-log-match-modal'))}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 rounded-full h-9 shadow-sm mr-2"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Log Match
                </Button>
              )}
              {/* Icons removed from here and moved to dropdown */}
              {authLoading ? (
                <div className="w-24 h-9 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
              ) : isLoggedIn ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="relative w-9 h-9 rounded-full border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all duration-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950 shrink-0 shadow-sm">
                      {userAvatar ? (
                        <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-sm">
                          {userName ? userName[0].toUpperCase() : "U"}
                        </div>
                      )}
                      {pendingActionCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow ring-2 ring-white dark:ring-slate-950">
                          {pendingActionCount > 9 ? "9+" : pendingActionCount}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-72 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl mt-1 p-2"
                  >
                    {/* Microsoft-style user card */}
                    <div className="flex items-start justify-between px-3 pt-2 pb-1">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">IISc Badminton Club</div>
                      <button onClick={() => handleSignOut()} className="text-xs font-bold text-slate-500 hover:text-rose-500 transition-colors">Sign out</button>
                    </div>
                    <div className="flex items-center gap-4 px-3 py-3 mb-2">
                      <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 relative shadow-sm">
                        {userAvatar ? (
                          <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-xl">
                            {userName ? userName[0].toUpperCase() : "U"}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-black text-slate-900 dark:text-white truncate">{userName}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1">{userEmail}</span>
                        <Link href={myPlayerId ? `/player/${myPlayerId}` : "/profile/setup"} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 hover:underline w-fit">
                          View profile
                        </Link>
                      </div>
                    </div>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 mx-1 mb-2" />
                        <Link href="/admin">
                          <DropdownMenuItem className="cursor-pointer font-medium rounded-xl text-violet-600 focus:bg-violet-50 dark:focus:bg-violet-950/30 gap-2 px-3 py-2.5">
                            <Zap className="h-4 w-4" /> Site Admin
                          </DropdownMenuItem>
                        </Link>
                      </>
                    )}
                    <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 my-1" />
                    {savedAccounts.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Switch Account</div>
                        {savedAccounts.map((acc) => (
                          <DropdownMenuItem
                            key={acc.id}
                            className="cursor-pointer font-medium rounded-xl focus:bg-slate-50 dark:focus:bg-slate-800 px-3 py-2"
                            onClick={async () => { await switchAccount(acc); }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{acc.name}</span>
                              <span className="text-[10px] text-slate-500">{acc.email}</span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 my-1" />
                      </>
                    )}
                    <Link href="/join?add_account=true">
                      <DropdownMenuItem className="cursor-pointer font-medium rounded-xl focus:bg-slate-50 dark:focus:bg-slate-800 gap-2 px-3 py-2.5">
                        <UserPlus className="h-4 w-4 text-slate-400" /> Add Account
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 my-1" />
                    <DropdownMenuItem
                      className="cursor-pointer text-rose-600 dark:text-rose-400 font-medium rounded-xl focus:bg-rose-50 dark:focus:bg-rose-950/30 gap-2 px-3 py-2.5"
                      onClick={() => handleSignOut("Are you sure you want to sign out of this account?")}
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/join">
                  <Button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 rounded-full h-9 shadow-sm shadow-emerald-200 dark:shadow-none transition-all duration-200 cursor-pointer">
                    <LogIn className="w-4 h-4" /> Sign In
                  </Button>
                </Link>
              )}
            </div>

            {/* ── Mobile Controls ───────────────────── */}
            <div className="flex lg:hidden items-center gap-1">
              {isLoggedIn && !authLoading && (
                <Link href={myPlayerId ? `/player/${myPlayerId}` : "/profile/setup"}>
                  <button 
                    className="relative w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-all duration-200 overflow-hidden shrink-0 shadow-sm mr-1 cursor-pointer"
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-xs">
                        {userName ? userName[0].toUpperCase() : "U"}
                      </div>
                    )}
                    {pendingActionCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white shadow ring-1 ring-white dark:ring-slate-950">
                        {pendingActionCount > 9 ? "9+" : pendingActionCount}
                      </span>
                    )}
                  </button>
                </Link>
              )}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Toggle menu"
              >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile Dropdown Menu ─────────────────────────────── */}
        {isOpen && (
          <div className="lg:hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 max-h-[85vh] overflow-y-auto">
            <div className="container mx-auto px-4 py-3 space-y-0.5">
              <MobileNavLink href="/" label="Home" isActive={isActive("/")} onClick={() => setIsOpen(false)} />
              {TOP_LEVEL_LINKS.map((link) => (
                <MobileNavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  badge={link.href === "/events" ? liveEventCount : link.href === "/feed" && hasUnreadAnnouncements ? -1 : undefined}
                  isActive={isActive(link.href)}
                  onClick={() => setIsOpen(false)}
                />
              ))}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-1">
                {authLoading ? (
                  <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ) : isLoggedIn ? (
                  <div className="space-y-0.5">

                    {isAdmin && (
                      <Link href="/admin">
                        <button className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-950/30 text-violet-600 font-medium text-sm transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
                          <Zap className="h-4 w-4" /> Site Admin
                        </button>
                      </Link>
                    )}
                    <button
                      className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 font-medium text-sm transition-colors cursor-pointer"
                      onClick={() => handleSignOut()}
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                ) : (
                  <Link href="/join">
                    <Button className="w-full flex items-center gap-2 justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11 cursor-pointer mt-1" onClick={() => setIsOpen(false)}>
                      <LogIn className="w-4 h-4" /> Sign In to your account
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
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
            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60"
        }`}
      >
        {label}
        {!!badge && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white px-0.5 shadow ring-2 ring-white dark:ring-slate-950">
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
            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50"
            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
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
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          Dark Mode
        </span>
        <div className={`w-8 h-4 rounded-full transition-colors relative ${isDark ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
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
      className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
