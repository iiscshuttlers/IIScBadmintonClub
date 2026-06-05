import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, UserCircle, LogIn, User, Settings, LogOut, UserPlus, ChevronDown, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigationAuth } from '@/hooks/useNavigationAuth';

const navGroups = [
  {
    label: 'About',
    links: [
      { href: '/about', label: 'About Us' },
      { href: '/facilities', label: 'Facilities' },
    ],
  },
  {
    label: 'Events',
    links: [
      { href: '/events', label: 'All Events' },
      { href: '/invicta', label: 'INVICTA' },
      { href: '/winners', label: 'Winners Wall' },
    ],
  },
  {
    label: 'Community',
    links: [
      { href: '/players', label: 'Players' },
      { href: '/announcements', label: 'Announcements' },
      { href: '/gallery', label: 'Gallery' },
    ],
  },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const {
    authLoading,
    isAdmin,
    isLoggedIn,
    myPlayerId,
    savedAccounts,
    signOut,
    switchAccount,
    userName,
  } = useNavigationAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  const handleSignOut = async (message = "Are you sure you want to sign out?") => {
    if (!confirm(message)) return;
    setIsOpen(false);
    await signOut();
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
            {/* Standalone: Home */}
            <Link href="/">
              <Button
                variant="ghost"
                className={`transition-colors ${
                  isActive('/')
                    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 font-semibold'
                    : 'text-blue-900 dark:text-slate-200 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                }`}
              >
                Home
              </Button>
            </Link>

            {/* Grouped dropdowns */}
            {navGroups.map((group) => (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`transition-colors flex items-center gap-1 ${
                      group.links.some(l => isActive(l.href))
                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 font-semibold'
                        : 'text-blue-900 dark:text-slate-200 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                    }`}
                  >
                    {group.label}
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl">
                  {group.links.map(link => (
                    <Link key={link.href} href={link.href}>
                      <DropdownMenuItem className={`cursor-pointer font-medium focus:bg-slate-50 dark:focus:bg-slate-800 ${isActive(link.href) ? 'text-emerald-600' : ''}`}>
                        {link.label}
                      </DropdownMenuItem>
                    </Link>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}

            {/* Standalone: Contact */}
            <Link href="/contact">
              <Button
                variant="ghost"
                className={`transition-colors ${
                  isActive('/contact')
                    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 font-semibold'
                    : 'text-blue-900 dark:text-slate-200 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                }`}
              >
                Contact
              </Button>
            </Link>
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
                  {isAdmin && (
                    <Link href="/admin">
                      <DropdownMenuItem className="cursor-pointer font-medium text-purple-600 focus:bg-slate-50 dark:focus:bg-slate-800">
                        <Settings className="mr-2 h-4 w-4" /> Site Admin
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                  
                  {savedAccounts.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Switch Account</div>
                      {savedAccounts.map(acc => (
                        <DropdownMenuItem 
                          key={acc.id}
                          className="cursor-pointer font-medium focus:bg-slate-50 dark:focus:bg-slate-800"
                          onClick={async () => {
                             await switchAccount(acc);
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
            <div className="flex flex-col gap-1">
              {/* Flat list of all links for mobile */}
              {[
                { href: '/', label: 'Home' },
                ...navGroups.flatMap(g => g.links),
                { href: '/contact', label: 'Contact' },
              ].map((link) => (
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
                    {isAdmin && (
                      <Link href="/admin">
                        <Button variant="ghost" className="w-full justify-start text-purple-600 font-medium hover:bg-purple-50 dark:hover:bg-purple-950/50">
                          <Settings className="mr-2 h-4 w-4" /> Site Admin
                        </Button>
                      </Link>
                    )}
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
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded-lg text-blue-900 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800 hover:text-emerald-600 transition-colors"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
