import { Link } from 'wouter';
import { ArrowRight, Medal, Trophy } from 'lucide-react';
import { ARCHIVED_TOURNAMENTS } from '@/data/tournamentArchive';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';

const cardVariant = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: 'easeOut' as const },
  }),
};

export default function WinnersWall() {
  usePageMeta({ title: 'Winners Wall', description: 'Champions and podium finishers from all IISc Badminton Club tournaments and events.' });
  const tournamentsWithResults = ARCHIVED_TOURNAMENTS.filter(
    (event) => event.winners || event.podium
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-950 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-sm font-bold mb-5">
            <Trophy className="w-4 h-4" />
            Club Records
          </div>
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-black mb-5"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Winners Wall
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Champions, podiums and archived results from IISc Badminton Club events.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 space-y-8">
        {tournamentsWithResults.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-slate-500">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold">No results archived yet.</p>
          </div>
        ) : (
          tournamentsWithResults.map((event, idx) => (
            <motion.div
              key={event.id}
              custom={idx}
              variants={cardVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="rounded-3xl shadow-md border border-emerald-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
            >
              {/* Top accent */}
              <div className={`h-1.5 bg-gradient-to-r ${
                event.type === 'open' ? 'from-emerald-500 to-teal-600' :
                event.type === 'team' ? 'from-blue-500 to-indigo-600' :
                'from-purple-500 to-pink-600'
              }`} />

              <div className="p-8 sm:p-10 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        event.type === 'open' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                        event.type === 'team' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' :
                        'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                      }`}>
                        {event.type === 'open' ? 'Open Tournament' : event.type === 'team' ? 'Team Event' : 'Special Event'}
                      </span>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-500">{event.startDate}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-blue-900 dark:text-white">
                      {event.name}
                    </h2>
                    <p className="text-gray-600 dark:text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
                      {event.description}
                    </p>
                  </div>

                  <Link href={`/events/${event.slug}`}>
                    <span className="inline-flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400 hover:gap-3 transition-all duration-200 shrink-0 text-sm">
                      Full results
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                </div>

                {/* Winners */}
                {event.winners && (
                  <div className="space-y-7">
                    {Object.entries(
                      event.winners.reduce((acc, curr) => {
                        const [group, ...rest] = curr.category.includes(':') ? curr.category.split(':') : ['Overall', curr.category];
                        const catName = rest.length > 0 ? rest.join(':').trim() : curr.category;
                        if (!acc[group]) acc[group] = [];
                        acc[group].push({ ...curr, category: catName });
                        return acc;
                      }, {} as Record<string, typeof event.winners>)
                    ).map(([group, results]) => (
                      <div key={group} className="space-y-3">
                        {group !== 'Overall' && (
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-5 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
                            <h3 className="text-base font-black text-blue-900 dark:text-white">{group}</h3>
                          </div>
                        )}
                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {results!.map((result) => (
                            <div
                              key={result.category}
                              className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/15 p-4 hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                                <Medal className="w-3.5 h-3.5" />
                                {result.category}
                              </div>
                              <p className="font-bold text-blue-950 dark:text-white text-sm">
                                🥇 {result.winner}
                              </p>
                              {result.runnerUp && (
                                <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                  🥈 {result.runnerUp}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Podium */}
                {event.podium && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {event.podium.map((team, index) => {
                      const rankConfig = [
                        { label: '🥇 Gold',   border: 'border-amber-300 dark:border-amber-700/60', bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400' },
                        { label: '🥈 Silver', border: 'border-slate-300 dark:border-slate-600',    bg: 'bg-slate-50 dark:bg-slate-800',     text: 'text-slate-600 dark:text-slate-300' },
                        { label: '🥉 Bronze', border: 'border-orange-300 dark:border-orange-700/60', bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-400' },
                      ];
                      const rank = rankConfig[index] ?? { label: `#${index + 1}`, border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-400' };
                      return (
                        <div
                          key={team}
                          className={`rounded-2xl border ${rank.border} ${rank.bg} p-4`}
                        >
                          <p className={`text-xs font-black uppercase tracking-wider ${rank.text}`}>
                            {rank.label}
                          </p>
                          <p className="mt-2 font-bold text-blue-950 dark:text-white text-sm">{team}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </section>
    </div>
  );
}
