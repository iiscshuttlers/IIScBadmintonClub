import { Link } from 'wouter';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Trophy, Radio, Medal } from 'lucide-react';
import { getTournaments } from '@/lib/tournaments';

const FAREWELL_EVENT = {
  id: 'farewell-2026',
  slug: 'farewell-match',
  status: 'completed',
  type: 'special',
  startDate: '2026-05-09',
  name: 'Farewell Badminton Tournament 2026',
  description:
    'Archived results from the farewell tournament featuring singles, doubles and mixed doubles.',
  champions: [
    ['MS', 'Jalaj (RBCCPS)'],
    ['MD', 'Kaling Danggen (CES) & Raja Janmejay (AE)'],
    ['WS', 'Radhika Dutt (CES)'],
    ['XD', 'Radhika Dutt (CES) & Kaling Danggen (CES)'],
  ],
};

export default function Events() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getTournaments();
        setEvents(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const live = events.filter((e) => e.status === 'live');
  const upcoming = events.filter((e) => e.status === 'upcoming');
  const completed = [
    FAREWELL_EVENT,
    ...events.filter((e) => e.status === 'completed' && e.slug !== FAREWELL_EVENT.slug),
  ];

  const getTypeLabel = (type: string) => {
    if (type === 'open') return 'Open Tournament';
    if (type === 'team') return 'Team Event';
    if (type === 'special') return 'Special Event';
    return type;
  };

  const renderCard = (item: any, liveMode = false) => (
    <Link href={`/events/${item.slug}`} key={item.id}>
      <Card className="rounded-3xl border border-emerald-200 shadow-md bg-white hover:shadow-xl hover:-translate-y-1 transition duration-300 cursor-pointer">
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

          {item.champions && (
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              {item.champions.map(([format, winner]: [string, string]) => (
                <div
                  key={format}
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-wider">
                    <Medal className="w-4 h-4" />
                    {format} Winner
                  </div>
                  <p className="mt-1 font-bold text-blue-950">{winner}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50">
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
          <p className="text-center text-gray-500 text-lg">
            Loading tournaments...
          </p>
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
