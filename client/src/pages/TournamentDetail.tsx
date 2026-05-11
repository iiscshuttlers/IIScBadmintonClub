import { Link, useRoute } from 'wouter';
import { ArrowLeft, Medal, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getArchivedTournament } from '@/data/tournamentArchive';

const PODIUM_COLORS = [
  'bg-yellow-50 border-yellow-200 text-yellow-900',
  'bg-gray-50 border-gray-200 text-gray-800',
  'bg-orange-50 border-orange-200 text-orange-900',
  'bg-blue-50 border-blue-200 text-blue-900',
];

const PODIUM_LABELS = ['Champion', 'Runner-up', 'Third Place', 'Fourth Place'];

export default function TournamentDetail() {
  const [, params] = useRoute('/events/:slug');
  const slug = params?.slug || '';
  const tournament = getArchivedTournament(slug);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="rounded-3xl shadow-md max-w-xl w-full">
          <CardContent className="p-10 text-center space-y-4">
            <h1 className="text-4xl font-bold text-blue-900">
              Tournament Not Found
            </h1>

            <p className="text-gray-600 text-lg">
              The tournament page you requested does not exist.
            </p>

            <Link href="/events">
              <span className="inline-flex items-center gap-2 text-blue-900 font-bold">
                <ArrowLeft className="w-4 h-4" />
                Back to Events
              </span>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {tournament.name}
          </h1>

          <p className="text-xl text-gray-200">
            {tournament.subtitle}
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 max-w-6xl space-y-8">
        <Link href="/events">
          <span className="inline-flex items-center gap-2 text-blue-900 font-bold">
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </span>
        </Link>

        <div className="grid lg:grid-cols-[1.4fr_0.8fr] gap-8 items-start">
          <Card className="rounded-3xl shadow-md">
            <CardContent className="p-8 sm:p-10 space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-wider mb-4">
                  <Trophy className="w-4 h-4" />
                  Completed
                </div>
                <h2 className="text-3xl font-bold text-blue-900 mb-3">
                  Results Archive
                </h2>
                <p className="text-gray-700 text-lg leading-relaxed">
                  {tournament.description}
                </p>
              </div>

              {tournament.winners && (
                <div className="grid md:grid-cols-2 gap-5">
                  {tournament.winners.map((result) => (
                    <div
                      key={result.category}
                      className="rounded-2xl bg-white border border-amber-200 p-5 shadow-sm"
                    >
                      <div className="flex items-center gap-2 text-amber-700 font-black text-xs uppercase tracking-wider">
                        <Medal className="w-4 h-4" />
                        {result.category}
                      </div>
                      <p className="mt-3 text-lg font-bold text-blue-950">
                        Winner: {result.winner}
                      </p>
                      {result.runnerUp && (
                        <p className="mt-1 text-gray-700">
                          Runner-up: {result.runnerUp}
                        </p>
                      )}
                      {result.bronze && (
                        <p className="mt-1 text-gray-700">
                          Third place: {result.bronze.join(' / ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tournament.podium && (
                <div className="grid sm:grid-cols-2 gap-5">
                  {tournament.podium.map((team, index) => (
                    <div
                      key={team}
                      className={`rounded-2xl border px-5 py-4 ${PODIUM_COLORS[index] || PODIUM_COLORS[3]}`}
                    >
                      <p className="text-xs font-black uppercase tracking-wider">
                        {PODIUM_LABELS[index] || `Rank ${index + 1}`}
                      </p>
                      <p className="mt-2 text-xl font-bold">{team}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-md">
            <CardContent className="p-8 sm:p-10">
              <h2 className="text-2xl font-bold text-blue-900 mb-6">
                Highlights
              </h2>

              {tournament.highlights && tournament.highlights.length > 0 ? (
                <div className="space-y-4 text-gray-700 leading-relaxed">
                  {tournament.highlights.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              ) : (
                <p className="text-gray-700 leading-relaxed">
                  Official category results are archived for club records and future reference.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
