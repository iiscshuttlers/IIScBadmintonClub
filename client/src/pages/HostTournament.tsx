import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Trophy, Plus, MapPin, LayoutDashboard, ShieldCheck, Search, Copy, Check, Briefcase, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';

export default function HostTournament() {
  usePageMeta({
    title: "My Tournaments",
    description: "Access your tournament command centers and organizer tools.",
  });

  const { session } = useAuth();
  const [, navigate] = useLocation();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTournaments() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('created_by', session.user.id)
        .order('created_at', { ascending: false });
      
      setTournaments(data || []);
      setLoading(false);
    }
    fetchTournaments();
  }, [session]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 lg:pb-8">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 sticky top-0 z-10 shadow-sm">
        <Link href="/">
          <button className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-sm font-black text-foreground truncate">My Tournaments</h1>
          <p className="text-xs text-muted-foreground truncate">UmpireApp Workspace</p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black">My Tournaments</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xl">
              Access your tournament command centers, captain lineup portals, umpire scoring, and organizer tools.
            </p>
          </div>

          <Link href="/host-tournament/new">
            <button className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 dark:hover:bg-cyan-400 text-white dark:text-slate-950 px-5 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-cyan-500/30">
              <Plus className="w-4 h-4" /> Create Tournament
            </button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-slate-200 dark:bg-slate-900 animate-pulse" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Briefcase className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No tournaments yet</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">Create a new event to get started with the UmpireApp command center.</p>
            <Link href="/host-tournament/new">
              <button className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 dark:hover:bg-cyan-400 text-white dark:text-slate-950 px-6 py-3 rounded-xl font-bold mx-auto transition-colors shadow-md">
                <Plus className="w-5 h-5" /> Create Tournament
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tournaments.map((t) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={t.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:border-cyan-500/30 transition-colors"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${t.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                      {t.status === 'active' ? 'Live' : 'Draft'}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                      Organizer
                    </span>
                  </div>
                  <h3 className="text-lg font-black leading-tight mb-2 text-slate-900 dark:text-white">{t.name}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5" /> {t.venue || 'No Venue'} • {t.tournament_type === 'team' ? 'Team Format' : 'Open Event'}
                  </div>
                </div>
                
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                  <Link href={`/tournament-admin?id=${t.id}`}>
                    <button className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg text-xs font-bold transition-colors">
                      <LayoutDashboard className="w-3.5 h-3.5" /> Manage
                    </button>
                  </Link>
                  <Link href={`/tournament-admin?id=${t.id}&tab=matches`}>
                    <button className="w-full flex items-center justify-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 py-2 rounded-lg text-xs font-bold transition-colors">
                      <ShieldCheck className="w-3.5 h-3.5" /> Referee
                    </button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
