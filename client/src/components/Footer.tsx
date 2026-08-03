import { Link } from "wouter";
import { Mail, MapPin, ExternalLink, ArrowUpRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export default function Footer() {
  const [apkUrl, setApkUrl] = useState(
    "https://github.com/iiscshuttlers/iiscshuttlers/releases/latest"
  );
  const [versionName, setVersionName] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/app-version.json?v=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.downloadUrl) setApkUrl(data.downloadUrl);
        if (data?.versionName) setVersionName(data.versionName);
      })
      .catch(() => {});
  }, []);

  const quickLinks = [
    { href: "/", label: "Home" },
    { href: "/pulse", label: "Pulse" },
    { href: "/hub", label: "Hub" },
    { href: "/legacy", label: "Legacy" },
    { href: "/glossary", label: "Glossary" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
    { href: "/delete-account", label: "Delete Account" },
  ];

  return (
    <footer className="relative bg-slate-950 text-foreground mt-12 overflow-hidden">
      {/* Top gradient bar */}
      <div className="h-[3px] bg-gradient-to-r from-primary via-teal-400 to-orange-500" />

      {/* Subtle dot pattern background */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(circle, #10b981 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-56 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative container mx-auto px-4 pt-10 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">

          {/* ── Brand & Contact ── */}
          <div className="lg:col-span-1 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" strokeOpacity="0.3"/>
                  <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4" strokeLinecap="round"/>
                  <path d="M5 12h2M17 12h2M12 5v2M12 17v2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base leading-tight">IISc Badminton Club</h3>
                <p className="text-[11px] text-primary/80 font-medium uppercase tracking-wider mt-0.5">Shuttlers · Est. 2018</p>
              </div>
            </div>

            <div className="space-y-3 text-sm pt-2">
              <div className="flex gap-3 items-center">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span className="text-muted-foreground">IISc Gymkhana, Bangalore</span>
              </div>
              <div className="flex gap-3 items-center">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <a href="mailto:iiscbadmintonclub@gmail.com" className="text-muted-foreground hover:text-primary transition-colors">
                  iiscbadmintonclub@gmail.com
                </a>
              </div>
            </div>

            {/* Social links */}
            <div className="flex gap-2.5 pt-2">
              <a
                href="https://www.instagram.com/badminton.iisc/"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="group w-9 h-9 rounded-xl bg-white/5 border border-white/8 hover:bg-pink-500/15 hover:border-pink-500/30 flex items-center justify-center transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground group-hover:text-pink-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                  <path d="m10 15 5-3-5-3z" />
                </svg>
              </a>
            </div>
          </div>

          {/* ── Quick Links ── */}
          <div>
            <h4 className="font-bold text-xs text-primary uppercase tracking-widest mb-4">Quick Links</h4>
            <ul className="grid grid-cols-2 gap-y-2.5">
              {quickLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href}>
                    <span className="group flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm cursor-pointer">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-primary transition-colors flex-shrink-0" />
                      {label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── App Download ── */}
          {!Capacitor.isNativePlatform() && (
            <div>
              <h4 className="font-bold text-xs text-primary uppercase tracking-widest mb-4">Get the App</h4>
              <a
                href={apkUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="group flex items-center gap-3.5 bg-white/4 border border-white/8 hover:bg-primary/8 hover:border-primary/25 rounded-2xl p-4 transition-all duration-300"
                title="Download Android App"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.523 15.341 14 13.438V8h-4v5.438l-3.523 1.903A1 1 0 0 0 6 16.277V20h12v-3.723a1 1 0 0 0-.477-.936zM8.008 6.192l1.5-2.598A.5.5 0 0 1 10 3.5h4a.5.5 0 0 1 .492.094l1.5 2.598A6.978 6.978 0 0 0 12 5a6.978 6.978 0 0 0-3.992 1.192z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-muted-foreground font-medium">Download for</div>
                  <div className="text-sm font-bold text-foreground">Android App</div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </a>
            </div>
          )}
        </div>

        {/* ── Bottom Bar ── */}
        <div className="border-t border-white/5 pt-5">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-muted-foreground text-xs">
              © {new Date().getFullYear()} IISc Badminton Club. All rights reserved.
              <Link href="/admin">
                <span className="text-foreground ml-1 select-none opacity-0">·</span>
              </Link>
            </p>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                Built with
                <span className="text-rose-500/70">♥</span>
              </p>
              {versionName && (
                <span className="text-muted-foreground text-xs font-mono bg-slate-800 px-2 py-0.5 rounded-md">
                  v{versionName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
