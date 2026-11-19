import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Trophy, Plus, MapPin, LayoutDashboard, Eye, Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTournamentsCreatedBy } from '@/services/tournamentService';
import { usePageMeta } from '@/hooks/usePageMeta';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusChip } from '@/components/admin/TournamentHeader';
import { tournamentManagePath, tournamentPath } from '@/lib/tournamentRoutes';
import type { Tournament } from '@/types/tournament';

export default function HostTournament() {
  usePageMeta({
    title: "My Tournaments",
    description: "Tournaments you organise.",
  });

  const { session, isAdmin } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }
      const data = await fetchTournamentsCreatedBy(session.user.id);
      setTournaments((data as Tournament[] | null) ?? []);
      setLoading(false);
    }
    load();
  }, [session]);

  const createButton = (
    <Link
      href="/host-tournament/new"
      className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-primary/20"
    >
      <Plus className="w-4 h-4" /> Create tournament
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 lg:pb-8">
      <PageHeader
        backTo="/tournaments"
        backLabel="Tournaments"
        badge="Organiser"
        badgeIcon={<Trophy className="w-3.5 h-3.5" />}
        title="My Tournaments"
        subtitle="Tournaments you created. Open one to set it up, run the draw and go live."
        align="left"
      >
        {createButton}
      </PageHeader>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-slate-200 dark:bg-slate-900 animate-pulse" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Briefcase className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No tournaments yet</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">Create one in four short steps. It stays a private draft until you go live.</p>
            <div className="flex justify-center">{createButton}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:border-primary/30 transition-colors"
              >
                <div>
                  <div className="mb-3"><StatusChip status={t.status} /></div>
                  <h3 className="text-lg font-black leading-tight mb-2 text-slate-900 dark:text-white">{t.name}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t.venue || 'No venue yet'} · {t.format_family === 'TEAM' ? 'Team event' : 'Open event'}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                  <Link
                    href={tournamentManagePath(t.id, isAdmin)}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-xs font-bold transition-colors"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" /> Manage
                  </Link>
                  <Link
                    href={tournamentPath(t.id)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Public page
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
