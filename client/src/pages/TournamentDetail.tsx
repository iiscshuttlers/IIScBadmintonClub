import { Link, useRoute } from 'wouter';
import { ArrowLeft, Medal, Trophy, GitBranch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getArchivedTournament } from '@/data/tournamentArchive';

const PODIUM_COLORS = [
  'bg-amber-50 border-amber-200 text-amber-900',
  'bg-gray-50 border-gray-200 text-gray-800',
  'bg-orange-50 border-orange-200 text-orange-900',
  'bg-blue-50 border-blue-200 text-blue-900',
];

const PODIUM_LABELS = ['🥇 Champion', '🥈 Runner-up', '🥉 Third Place', 'Fourth Place'];

// ── Bracket Viewer ──────────────────────────────────────────────────────────
type BracketMatch = { player1: string; player2: string; winner?: string; score?: string };
type BracketRound = { label: string; matches: BracketMatch[] };

function BracketViewer({ rounds }: { rounds: BracketRound[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max pb-4">
        {rounds.map((round, ri) => (
          <div key={ri} className="flex flex-col gap-4 min-w-[200px]">
            <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest text-center mb-2">
              {round.label}
            </h4>
            {round.matches.map((match, mi) => (
              <div key={mi} className="rounded-xl border border-gray-200 overflow-hidden shadow-sm text-sm">
                {[match.player1, match.player2].map((player, pi) => (
                  <div
                    key={pi}
                    className={`px-3 py-2 border-b last:border-b-0 flex justify-between items-center ${
                      match.winner === player
                        ? 'bg-emerald-50 font-bold text-emerald-800'
                        : 'bg-white text-gray-600'
                    }`}
                  >
                    <span className="truncate max-w-[130px]">{player || 'TBD'}</span>
                    {match.winner === player && match.score && (
                      <span className="text-xs text-emerald-600 ml-2 shrink-0">{match.score}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TournamentDetail() {
  const [, routeParams] = useRoute('/events/:slug');
  const params = routeParams ?? { slug: '' };
  const slug = params.slug;
  const tournament = getArchivedTournament(slug);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="rounded-3xl shadow-md max-w-xl w-full">
          <CardContent className="p-10 text-center space-y-4">
            <h1 className="text-4xl font-bold text-blue-900">Tournament Not Found</h1>
            <p className="text-gray-600 text-lg">The tournament page you requested does not exist.</p>
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
          <h1 className="text-4xl sm:text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            {tournament.name}
          </h1>
          <p className="text-xl text-gray-200">{tournament.subtitle}</p>
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
                <h2 className="text-3xl font-bold text-blue-900 mb-3">Results Archive</h2>
                <p className="text-gray-700 text-lg leading-relaxed">{tournament.description}</p>
              </div>

              {tournament.winners && (
                <div className="space-y-8">
                  {Object.entries(
                    tournament.winners.reduce((acc, curr) => {
                      const [group, ...rest] = curr.category.includes(':') ? curr.category.split(':') : ['Overall', curr.category];
                      const catName = rest.length > 0 ? rest.join(':').trim() : curr.category;
                      if (!acc[group]) acc[group] = [];
                      acc[group].push({ ...curr, category: catName });
                      return acc;
                    }, {} as Record<string, typeof tournament.winners>)
                  ).map(([group, results]) => (
                    <div key={group} className="space-y-4">
                      {group !== 'Overall' && (
                        <h3 className="text-xl font-bold text-blue-900 border-b border-emerald-100 pb-2">
                          {group}
                        </h3>
                      )}
                      <div className="grid md:grid-cols-2 gap-5">
                        {results.map((result) => (
                          <div key={result.category} className="rounded-2xl bg-white border border-amber-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-amber-700 font-black text-xs uppercase tracking-wider">
                              <Medal className="w-4 h-4" />
                              {result.category}
                            </div>
                            <p className="mt-3 text-lg font-bold text-blue-950 flex items-center gap-2"><span title="Winner">🥇 {result.winner}</span></p>
                            {result.runnerUp && <p className="mt-1 text-sm font-semibold text-slate-700 flex items-center gap-2"><span title="Runner-up">🥈 {result.runnerUp}</span></p>}
                            {result.bronze && <p className="mt-1 text-sm font-semibold text-slate-700 flex items-center gap-2"><span title="Third place">🥉 {result.bronze.join(' / ')}</span></p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tournament.podium && (
                <div className="grid sm:grid-cols-2 gap-5">
                  {tournament.podium.map((team, index) => (
                    <div key={team} className={`rounded-2xl border px-5 py-4 ${PODIUM_COLORS[index] || PODIUM_COLORS[3]}`}>
                      <p className="text-xs font-black uppercase tracking-wider">{PODIUM_LABELS[index] || `Rank ${index + 1}`}</p>
                      <p className="mt-2 text-xl font-bold">{team}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-md">
            <CardContent className="p-8 sm:p-10">
              <h2 className="text-2xl font-bold text-blue-900 mb-6">Highlights</h2>
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

        {/* ── Bracket Viewer ── */}
        <Card className="rounded-3xl shadow-md">
          <CardContent className="p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <GitBranch className="w-5 h-5 text-emerald-700" />
              </div>
              <h2 className="text-2xl font-bold text-blue-900">Tournament Bracket</h2>
            </div>

            {(tournament as any).bracket ? (
              <BracketViewer rounds={(tournament as any).bracket} />
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-12 text-center">
                <GitBranch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 font-semibold">Bracket not archived</p>
                <p className="text-gray-400 text-sm mt-1">
                  Live bracket tracking is available for ongoing tournaments.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
