import { useState } from 'react';
import { Link } from 'wouter';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Navigation Component
 * Fixed mobile + tablet responsive layout
 * Desktop unchanged
 */
export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/events', label: 'Events' },
    { href: '/winners', label: 'Winners' },
    { href: '/announcements', label: 'Announcements' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/contact', label: 'Contact' },
    { href: '/farewell', label: '🏆 Farewell Tournament' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md border-b-4 border-emerald-500">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">

          {/* Logo + Title */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer min-w-0">

              <img
                src={`${import.meta.env.BASE_URL}iisc-logo.png`}
                alt="IISc Logo"
                className="h-10 sm:h-12 w-auto object-contain flex-shrink-0"
              />

              <span className="font-semibold text-blue-900 leading-tight text-lg sm:text-2xl truncate">
                IISc Badminton Club
              </span>

            </div>
          </Link>

          {/* Desktop Navigation ONLY large screens */}
          <div className="hidden lg:flex gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  className="text-blue-900 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>

          {/* Mobile + Tablet Hamburger */}
          <button
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="w-6 h-6 text-blue-900" />
            ) : (
              <Menu className="w-6 h-6 text-blue-900" />
            )}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {isOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-gray-200 pt-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-blue-900 hover:text-emerald-600 hover:bg-emerald-50"
                    onClick={() => setIsOpen(false)}
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
