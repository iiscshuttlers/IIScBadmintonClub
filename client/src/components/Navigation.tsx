import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, UserCircle, LogIn, User, Settings, LogOut, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const authRequestIdRef = useRef(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  useEffect(() => {
    const readSavedAccounts = () => JSON.parse(localStorage.getItem("iisc_saved_accounts") || "[]");

    const clearAuthState = (accounts = readSavedAccounts()) => {
      setIsLoggedIn(false);
      setMyPlayerId(null);
      setUserName("");
      setSavedAccounts(accounts);
      setAuthLoading(false);
    };

    const removeSavedAccount = (userId?: string) => {
      if (!userId) return readSavedAccounts();
      const nextAccounts = readSavedAccounts().filter((a: any) => a.id !== userId);
      localStorage.setItem("iisc_saved_accounts", JSON.stringify(nextAccounts));
      return nextAccounts;
    };

    const loadAuth = async (session: Session | null) => {
      const requestId = ++authRequestIdRef.current;
      setAuthLoading(true);

      if (!session) {
        clearAuthState();
        return;
      }

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (requestId !== authRequestIdRef.current) return;

        if (userError || !userData.user || userData.user.id !== session.user.id) {
          const accounts = removeSavedAccount(session.user.id);
          clearAuthState(accounts);
          await supabase.auth.signOut();
          return;
        }

        const { data } = await supabase
          .from("players")
          .select("id, full_name, email")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (requestId !== authRequestIdRef.current) return;

        const name = data?.full_name?.split(" ")[0] ?? userData.user.email?.split("@")[0] ?? "Player";
        const accounts = readSavedAccounts();
        const existingIdx = accounts.findIndex((a: any) => a.id === userData.user.id);
        const newAccount = {
          id: userData.user.id,
          email: userData.user.email,
          name,
          session
        };
        if (existingIdx >= 0) accounts[existingIdx] = newAccount;
        else accounts.push(newAccount);
        localStorage.setItem("iisc_saved_accounts", JSON.stringify(accounts));

        setIsLoggedIn(true);
        setMyPlayerId(data?.id ?? null);
        setUserName(name);
        setSavedAccounts(accounts.filter((a: any) => a.id !== userData.user.id));
        setAuthLoading(false);
      } catch (err) {
        if (requestId !== authRequestIdRef.current) return;
        console.warn("Auth validation failed:", err);
        const accounts = removeSavedAccount(session.user.id);
        clearAuthState(accounts);
      }
    };

    let isMounted = true;
    const failsafeTimeout = setTimeout(() => {
      if (isMounted) setAuthLoading(false);
    }, 5000);

    (async () => { 
      try {
        const { data } = await supabase.auth.getSession(); 
        if (isMounted) loadAuth(data?.session || null); 
      } catch (e) {
        console.warn("Initial getSession failed:", e);
        if (isMounted) {
          clearAuthState();
          setAuthLoading(false);
        }
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => loadAuth(session)
    );

    const onStorage = (event: StorageEvent) => {
      if (event.key === "sb-auth-token" || event.key?.includes("auth-token")) {
        supabase.auth.getSession().then(({ data }) => loadAuth(data.session)).catch(() => setAuthLoading(false));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      isMounted = false;
      clearTimeout(failsafeTimeout);
      authRequestIdRef.current += 1;
      subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/events', label: 'Events' },
    { href: '/invicta', label: 'INVICTA' },
    { href: '/winners', label: 'Winners' },
    { href: '/players', label: 'Players' },
    { href: '/announcements', label: 'Announcements' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/contact', label: 'Contact' },
  ];

  const handleSignOut = async (message = "Are you sure you want to sign out?") => {
    if (!confirm(message)) return;

    authRequestIdRef.current += 1;
    setIsLoggedIn(false);
    setMyPlayerId(null);
    setUserName("");
    setIsOpen(false);

    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) {
      const accounts = JSON.parse(localStorage.getItem("iisc_saved_accounts") || "[]")
        .filter((a: any) => a.id !== data.session!.user.id);
      localStorage.setItem("iisc_saved_accounts", JSON.stringify(accounts));
      setSavedAccounts(accounts);
    }

    await supabase.auth.signOut();
    window.location.href = `${import.meta.env.BASE_URL}join`;
  };

  return (
    <nav className={`sticky top-0 z-50 bg-white dark:bg-slate-900 border-b-4 border-emerald-500 transition-all duration-300 ${scrolled ? 'shadow-xl' : 'shadow-md'}`}>
      <div className={`container mx-auto px-4 transition-all duration-300 ${scrolled ? 'py-2' : 'py-3'}`}>
        <div className="flex justify-between items-center">

          {/* Logo + Title */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer min-w-0">
              <img
                src={`${import.meta.env.BASE_URL}iisc-logo.png`}
                alt="IISc Logo"
                className={`w-auto object-contain flex-shrink-0 transition-all duration-300 ${scrolled ? 'h-8 sm:h-9' : 'h-10 sm:h-12'}`}
              />
              <span className="font-semibold text-blue-900 dark:text-white leading-tight text-lg sm:text-2xl truncate">
                IISc Badminton Club
              </span>
            </div>
          </Link>

          {/* Desktop Navigation — large screens only */}
          <div className="hidden lg:flex gap-1 items-center">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  className={`transition-colors ${
                    isActive(link.href)
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 font-semibold'
                      : 'text-blue-900 dark:text-slate-200 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                  }`}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
            {authLoading ? (
              <div className="w-24 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            ) : isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-3">
                    <UserCircle className="w-4 h-4" /> Hi, {userName}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl">
                  <Link href={myPlayerId ? `/player/${myPlayerId}` : "/profile/setup"}>
                    <DropdownMenuItem className="cursor-pointer font-medium focus:bg-slate-50 dark:focus:bg-slate-800">
                      <User className="mr-2 h-4 w-4" /> My Profile
                    </DropdownMenuItem>
                  </Link>
                  <Link href={myPlayerId ? `/player/${myPlayerId}/edit` : "/profile/setup"}>
                    <DropdownMenuItem className="cursor-pointer font-medium focus:bg-slate-50 dark:focus:bg-slate-800">
                      <Settings className="mr-2 h-4 w-4" /> Edit Profile
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                  
                  {savedAccounts.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Switch Account</div>
                      {savedAccounts.map(acc => (
                        <DropdownMenuItem 
                          key={acc.id}
                          className="cursor-pointer font-medium focus:bg-slate-50 dark:focus:bg-slate-800"
                          onClick={async () => {
                             await supabase.auth.setSession(acc.session);
                             window.location.reload();
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{acc.name}</span>
                            <span className="text-[10px] text-slate-500">{acc.email}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                    </>
                  )}
                  
                  <DropdownMenuItem className="cursor-pointer font-medium focus:bg-slate-50 dark:focus:bg-slate-800" asChild>
                    <Link href="/join?add_account=true" className="w-full flex items-center">
                      <UserPlus className="mr-2 h-4 w-4" /> Add Account
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                  <DropdownMenuItem 
                    className="cursor-pointer text-rose-600 dark:text-rose-400 font-medium focus:bg-rose-50 dark:focus:bg-rose-950/30 focus:text-rose-700 dark:focus:text-rose-300"
                    onClick={() => handleSignOut("Are you sure you want to sign out of this account?")}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/join">
                <Button className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-3">
                  <LogIn className="w-4 h-4" /> Sign In
                </Button>
              </Link>
            )}
            <DarkModeToggle />
          </div>

          {/* Mobile + Tablet: Dark toggle + Hamburger */}
          <div className="lg:hidden flex items-center gap-1">
            <DarkModeToggle />
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <X className="w-6 h-6 text-blue-900 dark:text-white" />
              ) : (
                <Menu className="w-6 h-6 text-blue-900 dark:text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {isOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-gray-200 dark:border-slate-700 pt-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start transition-colors ${
                      isActive(link.href)
                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 font-semibold'
                        : 'text-blue-900 dark:text-slate-200 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                    }`}
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                {authLoading ? (
                  <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                ) : isLoggedIn ? (
                  <div className="flex flex-col gap-1 mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                    <Link href={myPlayerId ? `/player/${myPlayerId}` : "/profile/setup"}>
                      <Button variant="ghost" className="w-full justify-start text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                        <User className="mr-2 h-4 w-4" /> My Profile
                      </Button>
                    </Link>
                    <Link href={myPlayerId ? `/player/${myPlayerId}/edit` : "/profile/setup"}>
                      <Button variant="ghost" className="w-full justify-start text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                        <Settings className="mr-2 h-4 w-4" /> Edit Profile & Password
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      onClick={() => handleSignOut()}
                    >
                      <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </Button>
                  </div>
                ) : (
                  <Link href="/join">
                    <Button className="w-full justify-start flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                      <LogIn className="w-4 h-4" /> Sign In
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function DarkModeToggle() {
  const [isDark, setIsDark] = useState(
    () => typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const goingDark = !root.classList.contains('dark');
    root.classList.toggle('dark', goingDark);
    localStorage.setItem('theme', goingDark ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded-lg text-blue-900 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800 hover:text-emerald-600 transition-colors"
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}
