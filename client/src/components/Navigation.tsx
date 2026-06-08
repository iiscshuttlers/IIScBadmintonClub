import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, UserCircle, LogIn, User, Settings, LogOut, UserPlus, ChevronDown, Moon, Sun, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigationAuth } from '@/hooks/useNavigationAuth';

const TOP_LEVEL_LINKS = [
  { href: '/events', label: 'Events' },
  { href: '/feed', label: 'Feed' },
  { href: '/players', label: 'Players' },
  { href: '/winners', label: 'Winners Wall' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/gallery', label: 'Gallery' },
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
    pendingActionCount,
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

  const handleSignOut = async (message = "Are you sure you want to sign out of all accounts?") => {
    if (!confirm(message)) return;
    setIsOpen(false);
    await signOut();
  };

  return (
    <nav className={`sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b-[3px] border-emerald-500 transition-all duration-300 ${scrolled && !isOpen ? 'shadow-xl' : 'shadow-sm'}`}>
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

          {/* Desktop Navigation */}
          <div className="hidden lg:flex gap-2 items-center">
            {/* Home Link */}
            <Link href="/">
              <Button
                variant="ghost"
                className={`transition-colors font-bold rounded-xl ${
                  isActive('/')
                    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950'
                    : 'text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                }`}
              >
                Home
              </Button>
            </Link>

            {/* Top-Level Links */}
            {TOP_LEVEL_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  className={`transition-colors font-bold rounded-xl ${
                    isActive(link.href)
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950'
                      : 'text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                  }`}
                >
                  {link.label}
                </Button>
              </Link>
            ))}

            {/* Direct link for Upcoming Tournament */}
            <Link href="/invicta">
              <Button variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 font-bold px-4 py-2 rounded-xl h-10 flex items-center gap-2 transition-all ml-2 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                INVICTA 2026
              </Button>
            </Link>

            <DarkModeToggle />
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-2" />
            {authLoading ? (
              <div className="w-24 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            ) : isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="relative flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-3">
                    <UserCircle className="w-4 h-4" /> Hi, {userName}
                    {pendingActionCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow ring-2 ring-white dark:ring-slate-900">
                        {pendingActionCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl">
                  <Link href={myPlayerId ? `/player/${myPlayerId}` : "/profile/setup"}>
                    <DropdownMenuItem className="cursor-pointer font-medium focus:bg-slate-50 dark:focus:bg-slate-800 flex justify-between items-center">
                      <div className="flex items-center"><User className="mr-2 h-4 w-4" /> My Profile</div>
                      {pendingActionCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 text-xs font-bold text-rose-600 dark:text-rose-400">
                          {pendingActionCount}
                        </span>
                      )}
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
                  
                  <div className="px-3 py-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> App Theme Color</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(() => {
                        const { accent, setAccent } = useTheme();
                        return ['emerald', 'violet', 'rose', 'amber', 'blue', 'cyberpunk'].map(color => {
                          const bgColors: Record<string, string> = { emerald: 'bg-emerald-500', violet: 'bg-violet-500', rose: 'bg-rose-500', amber: 'bg-amber-500', blue: 'bg-blue-500', cyberpunk: 'bg-black border border-[#00ffcc] shadow-[0_0_8px_#00ffcc]' };
                          return (
                            <div 
                              key={color} 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAccent?.(color as any); }}
                              className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${bgColors[color]} ${accent === color ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-white scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                            />
                          );
                        });
                      })()}
                    </div>
                  </div>

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
          </div>

          {/* Mobile Navigation Toggle & Theme */}
          <div className="flex lg:hidden items-center gap-1">
            <DarkModeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {isOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
              <Link href="/">
                <Button variant="ghost" className={`w-full justify-start text-lg py-6 ${isActive('/') ? 'text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/30' : ''}`} onClick={() => setIsOpen(false)}>Home</Button>
              </Link>
              {TOP_LEVEL_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button variant="ghost" className={`w-full justify-start text-lg py-6 ${isActive(link.href) ? 'text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/30' : 'text-slate-600 dark:text-slate-400'}`} onClick={() => setIsOpen(false)}>
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
                      <Button variant="ghost" className="w-full justify-between text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/50" onClick={() => setIsOpen(false)}>
                        <div className="flex items-center"><User className="mr-2 h-4 w-4" /> My Profile</div>
                        {pendingActionCount > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow">
                            {pendingActionCount}
                          </span>
                        )}
                      </Button>
                    </Link>
                    <Link href={myPlayerId ? `/player/${myPlayerId}/edit` : "/profile/setup"}>
                      <Button variant="ghost" className="w-full justify-start text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/50" onClick={() => setIsOpen(false)}>
                        <Settings className="mr-2 h-4 w-4" /> Edit Profile & Password
                      </Button>
                    </Link>
                    {isAdmin && (
                      <Link href="/admin">
                        <Button variant="ghost" className="w-full justify-start text-purple-600 font-medium hover:bg-purple-50 dark:hover:bg-purple-950/50" onClick={() => setIsOpen(false)}>
                          <Settings className="mr-2 h-4 w-4" /> Site Admin
                        </Button>
                      </Link>
                    )}
                    
                    {savedAccounts.length > 0 && (
                      <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="px-4 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Switch Account</div>
                        {savedAccounts.map(acc => (
                          <Button
                            key={acc.id}
                            variant="ghost"
                            className="w-full justify-start flex-col items-start h-auto py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={async () => {
                               setIsOpen(false);
                               await switchAccount(acc);
                            }}
                          >
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{acc.name}</span>
                            <span className="text-[10px] text-slate-500">{acc.email}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                      <Link href="/join?add_account=true">
                        <Button variant="ghost" className="w-full justify-start text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setIsOpen(false)}>
                          <UserPlus className="mr-2 h-4 w-4" /> Add Account
                        </Button>
                      </Link>
                    </div>
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
