import { Link } from 'wouter';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Trophy, Radio, Medal, ArrowRight, Clock } from 'lucide-react';
import { getTournaments } from '@/lib/tournaments';
import { ARCHIVED_TOURNAMENTS, ArchivedTournament, TournamentStatus } from '@/data/tournamentArchive';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import RunningFlyer from '@/components/RunningFlyer';

type LiveTournament = {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status: TournamentStatus;
  location?: string;
  type?: string;
  categories?: string[];
};

function EventSkeleton() {
  return (
    <div className="rounded-3xl border border-gray-200 shadow-md bg-white p-8 space-y-5 animate-pulse">
      <div className="flex gap-3">
        <div className="h-6 w-24 rounded-full bg-gray-200" />
        <div className="h-6 w-36 rounded-full bg-gray-200" />
      </div>
      <div className="h-8 w-3/4 rounded bg-gray-200" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-2/3 rounded bg-gray-200" />
      </div>
      <div className="h-5 w-28 rounded bg-gray-200" />
    </div>
  );
}

function NoUpcomingEvents() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-12 text-center">
      <Calendar className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-blue-900 mb-2">No upcoming tournaments</h3>
      <p className="text-gray-500 max-w-md mx-auto">
        No events are scheduled right now — check back soon, or browse our completed events below.
      </p>
    </div>
  );
}

function UpcomingCountdown({ event }: { event: any }) {
  const calcTime = () => {
    const diff = new Date(event.startDate).getTime() - Date.now();
    if (diff <= 0) return null;
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };

  const [time, setTime] = useState(calcTime);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ref.current = setInterval(() => setTime(calcTime()), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [event.startDate]);

  if (!time) return null;

  return (
    <div className="rounded-3xl bg-gradient-to-r from-blue-900 to-emerald-900 text-white p-8 mb-8 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-widest mb-2">
            <Clock className="w-4 h-4" />
            Next Tournament
          </div>
          <h2 className="text-3xl font-bold">{event.name}</h2>
          <p className="text-gray-300 mt-1">{event.startDate}</p>
        </div>
        <div className="flex gap-4 text-center">
          {[['Days', time.days], ['Hrs', time.hours], ['Min', time.minutes], ['Sec', time.seconds]].map(([label, val]) => (
            <div key={label as string} className="bg-white/10 rounded-2xl px-4 py-3 min-w-[64px]">
              <div className="text-3xl font-black tabular-nums">{String(val).padStart(2, '0')}</div>
              <div className="text-xs text-emerald-300 font-bold mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Events() {
  usePageMeta({ title: 'Events & Championships', description: 'Browse live, upcoming and completed badminton tournaments at IISc.' });

  const [events, setEvents] = useState<LiveTournament[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      const data = await getTournaments();
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Auto-refresh every 60s
  useAutoRefresh(loadEvents, 60_000, !loading);

  const live = events.filter((e) => e.status === 'live');
  const upcoming = events.filter((e) => e.status === 'upcoming');
  const completed: any[] = [
    ...ARCHIVED_TOURNAMENTS,
    ...events.filter(
      (e) =>
        e.status === 'completed' &&
        !ARCHIVED_TOURNAMENTS.some((archived) => archived.slug === e.slug)
    ),
  ];

  const getTypeLabel = (type: string) => {
    if (type === 'open') return 'Open Tournament';
    if (type === 'team') return 'Team Event';
    if (type === 'special') return 'Special Event';
    return type;
  };

  const renderCard = (item: any | ArchivedTournament, liveMode = false) => {
    const isUpcoming = item.status === 'upcoming';
    
    const cardContent = (
      <Card className="rounded-3xl border border-emerald-200 shadow-md bg-white hover:shadow-xl hover:-translate-y-1 transition duration-300 cursor-pointer h-full">
        <CardContent className="p-8 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            {liveMode && (
              <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold animate-pulse">
                🔴 LIVE
              </span>
            )}

            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
              {getTypeLabel(item.type)}
            </span>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              {item.startDate}
            </div>
          </div>

          <h3 className="text-3xl font-bold text-blue-900">
            {item.name}
          </h3>

          <p className="text-gray-700 text-lg">
            {item.description}
          </p>

          {'winners' in item && item.winners && (
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              {item.winners.slice(0, 4).map((result: any) => (
                <div
                  key={result.category}
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-wider">
                    <Medal className="w-4 h-4" />
                    {result.category}
                  </div>
                  <p className="mt-1 font-bold text-blue-950">{result.winner}</p>
                </div>
              ))}
            </div>
          )}

          {'podium' in item && item.podium && (
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              {item.podium.map((team: string, index: number) => (
                <div
                  key={team}
                  className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3"
                >
                  <p className="text-xs font-black text-blue-700 uppercase tracking-wider">
                    Rank {index + 1}
                  </p>
                  <p className="mt-1 font-bold text-blue-950">{team}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 font-bold text-blue-900">
            {isUpcoming ? (item.slug === 'invicta-2026' ? 'View Details' : 'Registrations starting soon') : item.status === 'live' ? 'View live fixtures' : 'View results'}
            <ArrowRight className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    );

    if (isUpcoming) {
      if (item.slug === 'invicta-2026') {
        return (
          <Link href="/invicta" key={item.id}>
            {cardContent}
          </Link>
        );
      }
      return (
        <div key={item.id} onClick={() => alert("Registrations will start soon! Stay tuned for more details.")} className="h-full">
          {cardContent}
        </div>
      );
    }

    return (
      <Link href={`/events/${item.slug}`} key={item.id}>
        {cardContent}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <RunningFlyer />
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1
            className="text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Events & Championships
          </h1>

          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            Live tournaments, upcoming competitions and archived events.
          </p>
        </div>
      </section>

      <section className="py-16 container mx-auto px-4 space-y-16">
        {loading && (
          <div className="grid md:grid-cols-2 gap-8">
            {Array.from({ length: 4 }).map((_, i) => <EventSkeleton key={i} />)}
          </div>
        )}

        {!loading && live.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-8">
              <Radio className="text-red-600" />
              <h2 className="text-4xl font-bold text-blue-900">
                Live Now
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {live.map((item) => renderCard(item, true))}
            </div>
          </div>
        )}

        {!loading && upcoming.length === 0 && live.length === 0 && (
          <NoUpcomingEvents />
        )}



        {!loading && upcoming.length > 0 && (
          <div>
            <h2 className="text-4xl font-bold text-blue-900 mb-8">
              Upcoming
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              {upcoming.map((item) => renderCard(item))}
            </div>
          </div>
        )}

        {!loading && completed.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-8">
              <Trophy className="text-orange-500" />
              <h2 className="text-4xl font-bold text-blue-900">
                Completed
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {completed.map((item) => renderCard(item))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
