import { Link } from 'wouter';
import { Home, Calendar, Trophy, Bell, Image, Info, Mail, Layers } from 'lucide-react';

const quickLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/winners', label: 'Winners', icon: Trophy },
  { href: '/announcements', label: 'Announcements', icon: Bell },
  { href: '/gallery', label: 'Gallery', icon: Image },
  { href: '/about', label: 'About', icon: Info },
  { href: '/contact', label: 'Contact', icon: Mail },
];

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-900 flex flex-col items-center justify-center px-4 text-white relative overflow-hidden">

      {/* Decorative shuttlecock court lines */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="none">
          <line x1="400" y1="0" x2="400" y2="600" stroke="white" strokeWidth="2" />
          <line x1="0" y1="300" x2="800" y2="300" stroke="white" strokeWidth="2" />
          <ellipse cx="400" cy="300" rx="160" ry="120" stroke="white" strokeWidth="2" fill="none" />
          <rect x="80" y="80" width="640" height="440" stroke="white" strokeWidth="3" fill="none" />
          <rect x="160" y="80" width="480" height="440" stroke="white" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      {/* Glowing orbs */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-emerald-500 rounded-full opacity-10 blur-3xl" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-blue-400 rounded-full opacity-10 blur-3xl" />

      {/* Main card */}
      <div className="relative z-10 text-center max-w-2xl mx-auto">

        {/* Shuttlecock icon + 404 */}
        <div className="mb-8 relative inline-block">
          <div className="text-[120px] font-black leading-none text-white/10 select-none tracking-tighter">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-full p-6 border border-white/20 shadow-2xl">
              <svg viewBox="0 0 64 64" className="w-16 h-16 text-emerald-400" fill="currentColor">
                {/* Shuttlecock feathers */}
                <ellipse cx="32" cy="20" rx="6" ry="14" opacity="0.5" />
                <ellipse cx="32" cy="20" rx="6" ry="14" transform="rotate(30 32 32)" opacity="0.5" />
                <ellipse cx="32" cy="20" rx="6" ry="14" transform="rotate(-30 32 32)" opacity="0.5" />
                <ellipse cx="32" cy="20" rx="6" ry="14" transform="rotate(60 32 32)" opacity="0.3" />
                <ellipse cx="32" cy="20" rx="6" ry="14" transform="rotate(-60 32 32)" opacity="0.3" />
                {/* Cork base */}
                <ellipse cx="32" cy="48" rx="7" ry="5" />
                <path d="M25 44 Q32 56 39 44" />
              </svg>
            </div>
          </div>
        </div>

        <h1
          className="text-4xl sm:text-5xl font-bold mb-4"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Out of Bounds!
        </h1>

        <p className="text-blue-200 text-lg mb-3 max-w-md mx-auto leading-relaxed">
          Looks like this page landed outside the court. It may have been moved, deleted, or the URL is incorrect.
        </p>

        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="h-px w-12 bg-emerald-500/50" />
          <Layers className="w-4 h-4 text-emerald-400" />
          <div className="h-px w-12 bg-emerald-500/50" />
        </div>

        {/* Primary CTA */}
        <Link href="/">
          <button className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-2xl shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-200 mb-10 text-lg">
            <Home className="w-5 h-5" />
            Back to Home
          </button>
        </Link>

        {/* Quick nav */}
        <div>
          <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-4">
            Or jump to a section
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {quickLinks.filter(l => l.href !== '/').map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-200 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 px-4 py-2 rounded-full transition-all duration-200 cursor-pointer">
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
