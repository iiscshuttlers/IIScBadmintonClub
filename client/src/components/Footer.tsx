import { Link } from 'wouter';
import { Mail, MapPin, ExternalLink } from 'lucide-react';

export default function Footer() {
  const quickLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/events', label: 'Events' },
    { href: '/winners', label: 'Winners Wall' },
    { href: '/announcements', label: 'Announcements' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <footer className="bg-gradient-to-br from-blue-950 to-slate-950 text-white mt-16">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-orange-500" />

      <div className="container mx-auto px-4 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="space-y-4 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl">
                🏸
              </div>
              <h3 className="font-bold text-lg text-white">IISc Badminton Club</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Promoting excellence in badminton through competitive play, training, and community engagement at the Indian Institute of Science.
            </p>
            <div className="flex gap-3 pt-1">
              <a
                href="https://www.instagram.com/badminton.iisc/"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-pink-500/20 hover:border-pink-500/40 flex items-center justify-center transition-all duration-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400 hover:text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a
                href="https://youtube.com/@iiscbadmintonclub"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-red-600/20 hover:border-red-600/40 flex items-center justify-center transition-all duration-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400 hover:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-sm text-emerald-400 uppercase tracking-widest mb-5">Quick Links</h4>
            <ul className="space-y-2.5">
              {quickLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href}>
                    <span className="text-slate-400 hover:text-emerald-400 transition-colors text-sm cursor-pointer flex items-center gap-1.5 group">
                      <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-emerald-500 transition-colors" />
                      {label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-sm text-emerald-400 uppercase tracking-widest mb-5">Contact</h4>
            <div className="space-y-4 text-sm">
              <div className="flex gap-3 items-start">
                <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-400 leading-relaxed">IISc Gymkhana, Bangalore — 560012, India</span>
              </div>
              <div className="flex gap-3 items-center">
                <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                <a
                  href="mailto:office.gym@iisc.ac.in"
                  className="text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  office.gym@iisc.ac.in
                </a>
              </div>
            </div>
          </div>

          {/* App Download + Facilities */}
          <div>
            <h4 className="font-bold text-sm text-emerald-400 uppercase tracking-widest mb-5">Get the App</h4>
            <a
              href="https://github.com/iiscshuttlers/iiscshuttlers/releases/latest/download/app-release.apk"
              className="group flex items-center gap-3 bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30 rounded-xl p-4 transition-all duration-300 mb-6"
              title="Download Android App"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 15.341 14 13.438V8h-4v5.438l-3.523 1.903A1 1 0 0 0 6 16.277V20h12v-3.723a1 1 0 0 0-.477-.936zM8.008 6.192l1.5-2.598A.5.5 0 0 1 10 3.5h4a.5.5 0 0 1 .492.094l1.5 2.598A6.978 6.978 0 0 0 12 5a6.978 6.978 0 0 0-3.992 1.192z"/>
                </svg>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Download for</div>
                <div className="text-sm font-bold text-white">Android App</div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 ml-auto transition-colors" />
            </a>

            <h4 className="font-bold text-sm text-emerald-400 uppercase tracking-widest mb-3">Facilities</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 3 Indoor Courts</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Synthetic Mat Flooring</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Professional Lighting</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Tournament Hosting</li>
            </ul>
          </div>

        </div>

        {/* Divider */}
        <div className="border-t border-white/5 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-600 text-xs">
              © {new Date().getFullYear()} IISc Badminton Club. All rights reserved.
              {/* Hidden admin doorway */}
              <Link href="/admin">
                <span className="text-slate-900 ml-1 select-none">·</span>
              </Link>
            </p>
            <p className="text-slate-600 text-xs">Built with ❤️ by the IISc Shuttlers community</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
