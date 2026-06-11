import { Link } from "wouter";
import { Mail, MapPin, ExternalLink, ArrowUpRight } from "lucide-react";
import { useState, useEffect } from "react";

export default function Footer() {
  const [apkUrl, setApkUrl] = useState(
    "https://github.com/iiscshuttlers/iiscshuttlers/releases/latest"
  );

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/app-version.json?v=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.downloadUrl) setApkUrl(data.downloadUrl);
      })
      .catch(() => {});
  }, []);

  const quickLinks = [
    { href: "/", label: "Home" },
    { href: "/features", label: "Features & Glossary" },
    { href: "/facilities", label: "Facilities" },
    { href: "/events", label: "Events" },
    { href: "/winners", label: "Winners Wall" },
    { href: "/announcements", label: "Announcements" },
    { href: "/gallery", label: "Gallery" },
    { href: "/contact", label: "Contact" },
  ];

  const facilities = [
    "3 Indoor Courts",
    "Synthetic Mat Flooring",
    "Professional Lighting",
    "Tournament Hosting",
  ];

  return (
    <footer className="relative bg-slate-950 text-white mt-20 overflow-hidden">
      {/* Top gradient bar */}
      <div className="h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-orange-500" />

      {/* Subtle dot pattern background */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(circle, #10b981 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-56 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative container mx-auto px-4 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">

          {/* ── Brand Column ── */}
          <div className="lg:col-span-1 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-emerald-400" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" strokeOpacity="0.3"/>
                  <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4" strokeLinecap="round"/>
                  <path d="M5 12h2M17 12h2M12 5v2M12 17v2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">IISc Badminton Club</h3>
                <p className="text-[11px] text-emerald-400/80 font-medium uppercase tracking-wider mt-0.5">Shuttlers · Est. 2018</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Promoting excellence in badminton through competitive play, training, and community engagement at the Indian Institute of Science, Bangalore.
            </p>

            {/* Social links */}
            <div className="flex gap-2.5 pt-1">
              <a
                href="https://www.instagram.com/badminton.iisc/"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="group w-9 h-9 rounded-xl bg-white/5 border border-white/8 hover:bg-pink-500/15 hover:border-pink-500/30 flex items-center justify-center transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500 group-hover:text-pink-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </a>
              <a
                href="https://youtube.com/@iiscbadmintonclub"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="group w-9 h-9 rounded-xl bg-white/5 border border-white/8 hover:bg-red-600/15 hover:border-red-600/30 flex items-center justify-center transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                  <path d="m10 15 5-3-5-3z" />
                </svg>
              </a>
            </div>
          </div>

          {/* ── Quick Links ── */}
          <div>
            <h4 className="font-bold text-xs text-emerald-400 uppercase tracking-widest mb-5">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href}>
                    <span className="group flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors text-sm cursor-pointer">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-emerald-500 transition-colors flex-shrink-0" />
                      {label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Contact ── */}
          <div>
            <h4 className="font-bold text-xs text-emerald-400 uppercase tracking-widest mb-5">Contact</h4>
            <div className="space-y-4 text-sm">
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-slate-400 leading-relaxed">
                  IISc Gymkhana, Bangalore<br />560012, India
                </span>
              </div>
              <div className="flex gap-3 items-center">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <a
                  href="mailto:office.gym@iisc.ac.in"
                  className="text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  office.gym@iisc.ac.in
                </a>
              </div>
            </div>

            {/* Facilities */}
            <div className="mt-7">
              <h4 className="font-bold text-xs text-emerald-400 uppercase tracking-widest mb-4">Facilities</h4>
              <ul className="space-y-2">
                {facilities.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── App Download ── */}
          <div>
            <h4 className="font-bold text-xs text-emerald-400 uppercase tracking-widest mb-5">Get the App</h4>
            <a
              href={apkUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="group flex items-center gap-3.5 bg-white/4 border border-white/8 hover:bg-emerald-500/8 hover:border-emerald-500/25 rounded-2xl p-4 transition-all duration-300 mb-3"
              title="Download Android App"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 15.341 14 13.438V8h-4v5.438l-3.523 1.903A1 1 0 0 0 6 16.277V20h12v-3.723a1 1 0 0 0-.477-.936zM8.008 6.192l1.5-2.598A.5.5 0 0 1 10 3.5h4a.5.5 0 0 1 .492.094l1.5 2.598A6.978 6.978 0 0 0 12 5a6.978 6.978 0 0 0-3.992 1.192z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-slate-500 font-medium">Download for</div>
                <div className="text-sm font-bold text-white">Android App</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
            </a>
            <p className="text-slate-500 text-xs leading-relaxed px-1">
              Full-featured native app with live scores, match logging, tournaments, and player profiles.
            </p>
          </div>
        </div>

        {/* ── Bottom Bar ── */}
        <div className="border-t border-white/5 pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-slate-600 text-xs">
              © {new Date().getFullYear()} IISc Badminton Club. All rights reserved.
              {/* Hidden admin doorway */}
              <Link href="/admin">
                <span className="text-slate-950 ml-1 select-none">·</span>
              </Link>
            </p>
            <p className="text-slate-600 text-xs flex items-center gap-1">
              Built with
              <span className="text-rose-500/70">♥</span>
              by the IISc community
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
