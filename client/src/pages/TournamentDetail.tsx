import { Link, useRoute } from 'wouter';
import { ArrowLeft, Medal, Trophy, GitBranch, Calendar, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getArchivedTournament } from '@/data/tournamentArchive';
import { motion } from 'framer-motion';

const PODIUM_CONFIGS = [
  { label: '🥇 Champion',    border: 'border-amber-300',  bg: 'bg-amber-50 dark:bg-amber-950/20',   text: 'text-amber-700 dark:text-amber-400',  ring: 'ring-amber-400' },
  { label: '🥈 Runner-up',   border: 'border-slate-300',  bg: 'bg-slate-50 dark:bg-slate-800',       text: 'text-slate-600 dark:text-slate-300',  ring: 'ring-slate-400' },
  { label: '🥉 Third Place', border: 'border-orange-300', bg: 'bg-orange-50 dark:bg-orange-950/20',  text: 'text-orange-700 dark:text-orange-400', ring: 'ring-orange-400' },
  { label: 'Fourth Place',   border: 'border-blue-200',   bg: 'bg-blue-50 dark:bg-blue-950/20',      text: 'text-blue-700 dark:text-blue-400',     ring: '' },
];

type BracketMatch = { player1: string; player2: string; winner?: string; score?: string };
type BracketRound = { label: string; matches: BracketMatch[] };

function BracketViewer({ rounds }: { rounds: BracketRound[] }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-6 min-w-max">
        {rounds.map((round, ri) => (
          <div key={ri} className="flex flex-col gap-4 min-w-[200px]">
            <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center mb-2">
              {round.label}
            </h4>
            {round.matches.map((match, mi) => (
              <div key={mi} className="rounded-xl border border-gray-200 dark:border-slate-600 overflow-hidden shadow-sm text-sm">
                {[match.player1, match.player2].map((player, pi) => (
                  <div
                    key={pi}
                    className={`px-3 py-2.5 border-b last:border-b-0 flex justify-between items-center dark:border-slate-600 ${
                      match.winner === player
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 font-bold text-emerald-800 dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="truncate max-w-[130px]">{player || 'TBD'}</span>
                    {match.winner === player && match.score && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-2 shrink-0 font-bold">{match.score}</span>
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

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.1, ease: 'easeOut' as const } }),
};

export default function TournamentDetail() {
  const [, routeParams] = useRoute('/events/:slug');
  const params = routeParams ?? { slug: '' };
  const slug = params.slug;
  const tournament = getArchivedTournament(slug);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center space-y-5 max-w-md">
          <div className="text-8xl font-black text-slate-200 dark:text-slate-800 select-none">?</div>
          <h1 className="text-3xl font-black text-blue-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
            Tournament Not Found
          </h1>
          <p className="text-gray-500 dark:text-slate-400">
            This tournament page doesn't exist or hasn't been archived yet.
          </p>
          <Link href="/events">
            <button className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5">
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const typeLabel = tournament.type === 'open' ? 'Open Tournament' : tournament.type === 'team' ? 'Team Event' : 'Special Event';
  const typeColor = tournament.type === 'open'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
    : tournament.type === 'team'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
    : 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-950 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-sm font-bold mb-5">
            <Trophy className="w-4 h-4" />
            {typeLabel}
          </div>
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-black mb-4"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            {tournament.name}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">{tournament.subtitle}</p>
          <div className="flex items-center justify-center gap-2 mt-4 text-gray-400 text-sm">
            <Calendar className="w-4 h-4" />
            {tournament.startDate}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 max-w-6xl space-y-8">

        {/* Back link */}
        <Link href="/events">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:gap-3 transition-all duration-200">
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </span>
        </Link>

        <div className="grid lg:grid-cols-[1.5fr_0.7fr] gap-8 items-start">

          {/* Main results card */}
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
            <Card className="rounded-3xl shadow-md border border-emerald-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600" />
              <CardContent className="p-8 sm:p-10 space-y-8">

                {/* Status + description */}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${typeColor}`}>
                      {typeLabel}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      ✓ Completed
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-blue-900 dark:text-white mb-3">Results Archive</h2>
                  <p className="text-gray-600 dark:text-slate-400 leading-relaxed">{tournament.description}</p>
                </div>

                {/* Winners grid */}
                {tournament.winners && (
                  <div className="space-y-8">
                    {Object.entries(
                      tournament.winners.reduce((acc, curr) => {
                        const [group, ...rest] = curr.category.includes(':')
                          ? curr.category.split(':')
                          : ['Overall', curr.category];
                        const catName = rest.length > 0 ? rest.join(':').trim() : curr.category;
                        if (!acc[group]) acc[group] = [];
                        acc[group].push({ ...curr, category: catName });
                        return acc;
                      }, {} as Record<string, typeof tournament.winners>)
                    ).map(([group, results]) => (
                      <div key={group} className="space-y-4">
                        {group !== 'Overall' && (
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
                            <h3 className="text-lg font-black text-blue-900 dark:text-white">{group}</h3>
                          </div>
                        )}
                        <div className="grid md:grid-cols-2 gap-4">
                          {results!.map((result) => (
                            <div key={result.category} className="rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 p-5 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-wider mb-3">
                                <Medal className="w-3.5 h-3.5" />
                                {result.category}
                              </div>
                              <p className="font-bold text-blue-950 dark:text-white flex items-center gap-2">
                                🥇 {result.winner}
                              </p>
                              {result.runnerUp && (
                                <p className="mt-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                  🥈 {result.runnerUp}
                                </p>
                              )}
                              {result.bronze && (
                                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-500 flex items-center gap-2">
                                  🥉 {result.bronze.join(' / ')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Podium grid */}
                {tournament.podium && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
                      <h3 className="text-lg font-black text-blue-900 dark:text-white">Final Standings</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {tournament.podium.map((team, index) => {
                        const cfg = PODIUM_CONFIGS[index] ?? PODIUM_CONFIGS[3];
                        return (
                          <div key={team} className={`rounded-2xl border ${cfg.border} ${cfg.bg} px-5 py-4 hover:shadow-sm transition-shadow`}>
                            <p className={`text-xs font-black uppercase tracking-wider ${cfg.text}`}>{cfg.label}</p>
                            <p className="mt-2 text-lg font-bold text-blue-950 dark:text-white">{team}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar */}
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">

            {/* Highlights */}
            <Card className="rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
              <CardContent className="p-7">
                <h2 className="text-lg font-black text-blue-900 dark:text-white mb-5">Event Highlights</h2>
                {tournament.highlights && tournament.highlights.length > 0 ? (
                  <div className="space-y-3">
                    {tournament.highlights.map((item, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-slate-500 leading-relaxed">
                    Official category results are archived for club records and future reference.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick info */}
            <Card className="rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
              <CardContent className="p-7 space-y-4">
                <h2 className="text-lg font-black text-blue-900 dark:text-white mb-2">Tournament Info</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-gray-500 dark:text-slate-400 font-medium">Year</span>
                    <span className="font-bold text-blue-900 dark:text-white">{tournament.startDate}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-gray-500 dark:text-slate-400 font-medium">Format</span>
                    <span className="font-bold text-blue-900 dark:text-white">{typeLabel}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-500 dark:text-slate-400 font-medium">Status</span>
                    <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Completed
                    </span>
                  </div>
                </div>

                <Link href="/winners">
                  <button className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 dark:bg-blue-800 dark:hover:bg-blue-700 text-white font-bold px-4 py-3 rounded-xl text-sm transition-all hover:-translate-y-0.5">
                    <Trophy className="w-4 h-4" />
                    All Winners
                  </button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bracket Viewer */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <Card className="rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 to-blue-600" />
            <CardContent className="p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-purple-100 dark:bg-purple-950/30 rounded-xl">
                  <GitBranch className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                </div>
                <h2 className="text-xl font-black text-blue-900 dark:text-white">Tournament Bracket</h2>
              </div>

              {(tournament as any).bracket ? (
                <BracketViewer rounds={(tournament as any).bracket} />
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 py-14 text-center">
                  <GitBranch className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-400 dark:text-slate-500 font-semibold">Bracket not archived</p>
                  <p className="text-gray-400 dark:text-slate-600 text-sm mt-1">
                    Live bracket tracking is available for ongoing tournaments.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

      </section>
    </div>
  );
}
