import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);

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

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/players', label: 'Players' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/events', label: 'Events' },
    { href: '/winners', label: 'Winners' },
    { href: '/announcements', label: 'Announcements' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/contact', label: 'Contact' },
  ];

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
