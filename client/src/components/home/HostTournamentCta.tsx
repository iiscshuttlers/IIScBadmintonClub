import { Link } from "wouter";
import { Trophy, ArrowRight } from "lucide-react";

export function HostTournamentCta() {
  return (
    <Link href="/host-tournament">
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md mb-4 cursor-pointer hover:border-primary/50 transition-all group active:scale-[0.99]">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-xs">
          <Trophy className="w-5 h-5 text-slate-950" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Tournament Engine</p>
          <p className="text-sm font-black text-slate-900 dark:text-slate-100 leading-tight">Want to host or organize your own tournament?</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2 bg-primary group-hover:brightness-105 text-slate-950 rounded-xl text-xs font-black shrink-0 transition-all shadow-xs">
          Host an event
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
}
