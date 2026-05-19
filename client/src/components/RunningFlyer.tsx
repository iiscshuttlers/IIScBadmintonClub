import { Link } from 'wouter';

export default function RunningFlyer() {
  const message = `🏸 Upcoming Event: INVICTA Open Tournament (Tentative: June 2026) - Registrations starting soon! 🏸`;

  return (
    <Link href="/events">
      <div className="bg-emerald-600 text-white py-2.5 overflow-hidden flex items-center relative z-20 shadow-md whitespace-nowrap hover:bg-emerald-700 transition-colors cursor-pointer">
        <div className="marquee-anim flex gap-12 font-bold tracking-wide text-sm md:text-base whitespace-nowrap">
          {Array(6).fill(null).map((_, i) => (
            <span key={i} className="whitespace-nowrap">{message}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
