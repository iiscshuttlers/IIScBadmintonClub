import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getTournaments } from "@/lib/tournaments";
import { fetchSiteData } from "@/lib/siteData";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { registerPushNotifications } from "@/lib/pushNotifications";
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
import { QuickSettingsContent } from "@/components/QuickSettings";
import { GlobalSearch } from "@/components/GlobalSearch";

const TOP_LEVEL_LINKS = [
  { href: "/events", label: "Events" },
  { href: "/feed", label: "Feed" },
  { href: "/players", label: "Players" },
  { href: "/find-lost", label: "Find & Lost" },
  { href: "/hall-of-fame", label: "Winners Wall" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "Club" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
  const { theme, toggleTheme } = useTheme();

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

  // Register push notifications
  useEffect(() => {
    if (myPlayerId) {
      registerPushNotifications(myPlayerId).catch(console.error);
    }
  }, [myPlayerId]);

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

  const handleSignOut = async (
    message = "Are you sure you want to sign out of all accounts?"
  ) => {
    if (!confirm(message)) return;
    setIsOpen(false);
    await signOut();
  };

  const handleInvite = async () => {
    const inviteText = "Join me on IISc Shuttlers! The ultimate platform for badminton tracking.";
    const inviteUrl = "https://iiscshuttlers.com/join";
    
    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: "Join IISc Shuttlers",
        text: inviteText,
        url: inviteUrl,
        dialogTitle: "Invite Friends",
      });
    } else if (navigator.share) {
      await navigator.share({
        title: "Join IISc Shuttlers",
        text: inviteText,
        url: inviteUrl,
      });
    } else {
      await navigator.clipboard.writeText(`${inviteText} ${inviteUrl}`);
      toast.success("Invite link copied to clipboard!");
    }
    setIsOpen(false);
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
                  onClick={() => window.dispatchEvent(new Event('openLogMatchModal'))}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 rounded-full h-9 shadow-sm mr-2"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Log Match
                </Button>
              )}

              {/* Global Search Button */}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700 mr-1"
                title="Search (⌘K)"
              >
                <Search className="w-4 h-4" />
                <span className="hidden xl:inline text-xs font-medium">Search</span>
                <kbd className="hidden xl:inline font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-400">⌘K</kbd>
              </button>

              {/* Icons removed from here and moved to dropdown */}
              {authLoading ? (
                <div className="w-24 h-9 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
              ) : isLoggedIn ? (
                <>
                  {myPlayerId && <NotificationsMenu currentUser={{ id: myPlayerId }} />}
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
                    className="w-80 p-0 border-0 overflow-hidden rounded-2xl shadow-2xl shadow-slate-300/40 dark:shadow-black/60"
                  >
                    {/* ── Hero user card ── */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950 px-4 pt-3 pb-4">
                      {/* Decorative circles */}
                      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
                      <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
                      <div className="absolute top-6 right-16 w-8 h-8 rounded-full bg-white/10 pointer-events-none" />

                      <div className="relative flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/50">IISc Badminton Club</span>
                        <button onClick={() => handleSignOut()} className="text-[11px] font-bold text-white/50 hover:text-white/90 transition-colors px-2 py-0.5 rounded-md hover:bg-white/10">
                          Sign out
                        </button>
                      </div>

                      <div className="relative flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border-2 border-white/30 shadow-lg shadow-black/20 ring-2 ring-white/10">
                          {userAvatar ? (
                            <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center font-black text-xl">
                              {userName ? userName[0].toUpperCase() : "U"}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white text-base leading-tight truncate">{userName}</p>
                          <p className="text-white/55 text-xs truncate mt-0.5">{userEmail}</p>
                          <Link
                            href={myPlayerId ? `/player/${myPlayerId}` : "/profile/setup"}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full transition-all"
                          >
                            View profile →
                          </Link>
                        </div>
                        {pendingActionCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow ring-2 ring-white/30">
                            {pendingActionCount > 9 ? "9+" : pendingActionCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Settings body ── */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 space-y-2 max-h-[70vh] overflow-y-auto">

                      {/* Light / Dark toggle */}
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-1 flex gap-1 shadow-sm border border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => { if (theme === "dark") toggleTheme(); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            theme === "light"
                              ? "bg-amber-50 text-amber-700 shadow-sm border border-amber-200 dark:bg-slate-700 dark:text-amber-400 dark:border-slate-600"
                              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5" /> Light
                        </button>
                        <button
                          onClick={() => { if (theme === "light") toggleTheme(); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            theme === "dark"
                              ? "bg-indigo-950/60 text-indigo-300 shadow-sm border border-indigo-800 dark:bg-indigo-950/60"
                              : "text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5" /> Dark
                        </button>
                      </div>

                      {/* QuickSettings: accent colors + live status + notifications */}
                      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <QuickSettingsContent />
                      </div>

                      {/* Action items */}
                      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <Link href="/profile/password">
                          <DropdownMenuItem className="cursor-pointer font-semibold rounded-none text-slate-700 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 px-3 py-2.5 gap-2.5">
                            <Lock className="w-4 h-4 text-slate-400" /> Change Password
                          </DropdownMenuItem>
                        </Link>
                        {isAdmin && (
                          <Link href="/admin">
                            <DropdownMenuItem className="cursor-pointer font-semibold rounded-none text-violet-600 dark:text-violet-400 focus:bg-violet-50 dark:focus:bg-violet-950/30 gap-2.5 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
                              <Zap className="h-4 w-4" /> Site Admin
                            </DropdownMenuItem>
                          </Link>
                        )}
                      </div>

                      {/* Switch / Add Account */}
                      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        {savedAccounts.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                              Switch Account
                            </div>
                            {savedAccounts.map((acc) => (
                              <DropdownMenuItem
                                key={acc.id}
                                className="cursor-pointer font-medium rounded-none focus:bg-slate-50 dark:focus:bg-slate-800 px-3 py-2.5 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0"
                                onClick={async () => { await switchAccount(acc); }}
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{acc.name}</span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{acc.email}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 m-0" />
                          </>
                        )}
                        <Link href="/join?add_account=true">
                          <DropdownMenuItem className="cursor-pointer font-semibold rounded-none text-slate-700 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 gap-2.5 px-3 py-2.5">
                            <UserPlus className="h-4 w-4 text-slate-400" /> Add Account
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem onClick={handleInvite} className="cursor-pointer font-semibold rounded-none text-slate-700 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 border-t border-slate-100 dark:border-slate-800 gap-2.5 px-3 py-2.5">
                          <UserPlus className="h-4 w-4 text-emerald-500" /> Invite Friends
                        </DropdownMenuItem>
                      </div>

                      {/* Sign Out */}
                      <button
                        onClick={() => handleSignOut("Are you sure you want to sign out of this account?")}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/25 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold text-sm border border-rose-100 dark:border-rose-900/50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                </>
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
              {/* Mobile Search */}
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
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

                {/* ── Light / Dark toggle — always visible ── */}
                <div className="mb-3 flex bg-slate-100 dark:bg-slate-900 rounded-2xl p-1.5 gap-1.5 border border-slate-200/60 dark:border-slate-800">
                  <button
                    onClick={() => { if (theme === "dark") toggleTheme(); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      theme === "light"
                        ? "bg-white shadow-sm text-amber-600 border border-amber-200/60"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    <Sun className="w-4 h-4" /> Light
                  </button>
                  <button
                    onClick={() => { if (theme === "light") toggleTheme(); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      theme === "dark"
                        ? "bg-slate-800 shadow-sm text-indigo-300 border border-indigo-800/60"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Moon className="w-4 h-4" /> Dark
                  </button>
                </div>

                {authLoading ? (
                  <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ) : isLoggedIn ? (
                  <div className="space-y-0.5">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl mb-2 overflow-hidden border border-slate-100 dark:border-slate-800">
                      <QuickSettingsContent />
                      <div className="h-px bg-slate-200 dark:bg-slate-800 my-1 mx-2" />
                      <Link href="/profile/password">
                        <button className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
                          <Lock className="h-4 w-4 text-slate-400" /> Change Password
                        </button>
                      </Link>
                    </div>

                    {isAdmin && (
                      <Link href="/admin">
                        <button className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-950/30 text-violet-600 font-medium text-sm transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
                          <Zap className="h-4 w-4" /> Site Admin
                        </button>
                      </Link>
                    )}
                    <button
                      className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer"
                      onClick={handleInvite}
                    >
                      <UserPlus className="h-4 w-4 text-emerald-500" /> Invite Friends
                    </button>
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

      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
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
