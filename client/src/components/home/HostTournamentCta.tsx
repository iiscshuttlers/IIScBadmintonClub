import { Link } from "wouter";
import { Trophy, ArrowRight } from "lucide-react";

export function HostTournamentCta() {
  return (
    <Link href="/host-tournament">
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg mb-4 cursor-pointer hover:border-lime-500/40 transition-colors group">
        <div className="w-10 h-10 rounded-xl bg-lime-400 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-slate-900" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-lime-400">Powered by UmpireApp</p>
          <p className="text-sm font-black text-slate-100 leading-tight">Want to run your own tournament?</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2 bg-lime-400 group-hover:bg-lime-300 text-slate-900 rounded-xl text-xs font-bold shrink-0 transition-colors">
          Host a tournament
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
}
