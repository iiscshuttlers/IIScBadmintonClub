import { Link } from 'wouter';
import { X } from 'lucide-react';
import { useState } from 'react';

export default function RunningFlyer() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const message = `🏸 Upcoming Event: INVICTA Open Tournament (Tentative: June 2026) — Registrations are closed`;

  return (
    <div className="relative bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-2.5 overflow-hidden flex items-center z-20 shadow-md">
      <Link href="/events" className="flex-1 overflow-hidden">
        <div className="marquee-anim flex gap-16 font-semibold tracking-wide text-sm md:text-base whitespace-nowrap hover:opacity-90 transition-opacity cursor-pointer">
          {Array(6).fill(null).map((_, i) => (
            <span key={i} className="whitespace-nowrap flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/60" />
              {message}
            </span>
          ))}
        </div>
      </Link>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="flex-shrink-0 ml-2 mr-2 p-1 rounded-full hover:bg-white/20 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
