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
import { QuickSettings } from "@/components/QuickSettings";

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
    const lastSeen = localStorage.getItem("iisc_announcements_last_seen");
    if (!lastSeen) {
      setHasUnreadAnnouncements(true);
    } else {
      const elapsed = Date.now() - parseInt(lastSeen, 10);
      setHasUnreadAnnouncements(elapsed > 24 * 60 * 60 * 1000);
    }
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
              <QuickSettings />
              <DarkModeToggle />
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

              {authLoading ? (
                <div className="w-24 h-9 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
              ) : isLoggedIn ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="relative flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 rounded-full h-9 shadow-sm shadow-emerald-200 dark:shadow-none transition-all duration-200">
                      <UserCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="max-w-[80px] truncate">Hi, {userName}</span>
                      <ChevronDown className="w-3 h-3 opacity-70 flex-shrink-0" />
                      {pendingActionCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow ring-2 ring-white dark:ring-slate-950">
                          {pendingActionCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-52 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl mt-1 p-1"
                  >
                    <Link href={myPlayerId ? `/player/${myPlayerId}` : "/profile/setup"}>
                      <DropdownMenuItem className="cursor-pointer font-medium rounded-xl focus:bg-slate-50 dark:focus:bg-slate-800 flex justify-between items-center px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" /> My Profile
                        </div>
                        {pendingActionCount > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 text-xs font-bold text-rose-600">{pendingActionCount}</span>
                        )}
                      </DropdownMenuItem>
                    </Link>
                    <Link href={myPlayerId ? `/player/${myPlayerId}/edit` : "/profile/setup"}>
                      <DropdownMenuItem className="cursor-pointer font-medium rounded-xl focus:bg-slate-50 dark:focus:bg-slate-800 gap-2 px-3 py-2.5">
                        <Settings className="h-4 w-4 text-slate-400" /> Edit Profile
                      </DropdownMenuItem>
                    </Link>
                    {isAdmin && (
                      <Link href="/admin">
                        <DropdownMenuItem className="cursor-pointer font-medium rounded-xl text-violet-600 focus:bg-violet-50 dark:focus:bg-violet-950/30 gap-2 px-3 py-2.5">
                          <Zap className="h-4 w-4" /> Site Admin
                        </DropdownMenuItem>
                      </Link>
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
              <Link href="/about?tab=glossary">
                <button
                  aria-label="Features & Glossary"
                  className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-[18px] h-[18px]" />
                </button>
              </Link>
              <QuickSettings />
              <DarkModeToggle />
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

              <div className="pt-2 pb-1 space-y-1.5">
                <Link href="/about?tab=glossary" onClick={() => setIsOpen(false)}>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <BookOpen className="w-4 h-4 text-emerald-500" /> Features & Glossary
                  </div>
                </Link>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-1">
                {authLoading ? (
                  <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ) : isLoggedIn ? (
                  <div className="space-y-0.5">
                    <Link href={myPlayerId ? `/player/${myPlayerId}` : "/profile/setup"}>
                      <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
                        <span className="flex items-center gap-2"><User className="h-4 w-4 text-emerald-500" /> My Profile</span>
                        {pendingActionCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{pendingActionCount}</span>}
                      </button>
                    </Link>
                    <Link href={myPlayerId ? `/player/${myPlayerId}/edit` : "/profile/setup"}>
                      <button className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
                        <Settings className="h-4 w-4 text-emerald-500" /> Edit Profile
                      </button>
                    </Link>
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

function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
    >
      {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
    </button>
  );
}
