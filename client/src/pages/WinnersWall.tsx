import { Link } from 'wouter';
import { ArrowRight, Medal, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ARCHIVED_TOURNAMENTS } from '@/data/tournamentArchive';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function WinnersWall() {
  usePageMeta({ title: 'Winners Wall', description: 'Champions and podium finishers from all IISc Badminton Club tournaments and events.' });
  const tournamentsWithResults = ARCHIVED_TOURNAMENTS.filter(
    (event) => event.winners || event.podium
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-bold mb-5">
            <Trophy className="w-4 h-4 text-amber-300" />
            Club Records
          </div>

          <h1
            className="text-4xl sm:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Winners Wall
          </h1>

          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            Champions, podiums and archived results from IISc Badminton Club events.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 space-y-8">
        {tournamentsWithResults.map((event) => (
          <Card key={event.id} className="rounded-3xl shadow-md border border-emerald-100">
            <CardContent className="p-8 sm:p-10 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                <div>
                  <p className="text-sm font-bold text-emerald-700">
                    {event.startDate}
                  </p>
                  <h2 className="text-3xl font-bold text-blue-900 mt-1">
                    {event.name}
                  </h2>
                  <p className="text-gray-700 mt-2 max-w-3xl">
                    {event.description}
                  </p>
                </div>

                <Link href={`/events/${event.slug}`}>
                  <span className="inline-flex items-center gap-2 font-bold text-blue-900 shrink-0">
                    Full results
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              </div>

              {event.winners && (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {event.winners.map((result) => (
                    <div
                      key={result.category}
                      className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
                    >
                      <div className="flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-wider">
                        <Medal className="w-4 h-4" />
                        {result.category}
                      </div>
                      <p className="mt-2 font-bold text-blue-950">
                        {result.winner}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {event.podium && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {event.podium.map((team, index) => (
                    <div
                      key={team}
                      className="rounded-2xl border border-blue-100 bg-blue-50 p-5"
                    >
                      <p className="text-xs font-black text-blue-700 uppercase tracking-wider">
                        Rank {index + 1}
                      </p>
                      <p className="mt-2 font-bold text-blue-950">{team}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
