import { useState } from 'react';
import { Trophy, Clock, ChevronRight, Activity, CheckCircle2, Calendar } from 'lucide-react';

const FORMAT_LABELS: Record<string, string> = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
};

const FORMAT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  MS: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', dot: 'bg-blue-500' },
  WS: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-100', dot: 'bg-pink-500' },
  MD: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-500' },
  WD: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', dot: 'bg-purple-500' },
  XD: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', dot: 'bg-orange-500' },
};

const POOL_COLORS: Record<string, string> = {
  Finals: 'from-amber-50 to-yellow-50 border-amber-200',
  'League A': 'from-blue-50 to-indigo-50 border-blue-100',
  'League B': 'from-emerald-50 to-teal-50 border-emerald-100',
  League: 'from-slate-50 to-gray-50 border-slate-200',
  KO: 'from-rose-50 to-red-50 border-rose-100',
};

interface ScheduleViewProps {
  tournamentData: any;
}

export function ScheduleView({ tournamentData }: ScheduleViewProps) {
  if (!tournamentData) return null;

  const [activeFormat, setActiveFormat] = useState<string>('ALL');

  // Flatten all matches with format tag
  const allMatches = Object.entries(tournamentData.matches).flatMap(
    ([format, matches]: [string, any]) =>
      (matches as any[]).map((m) => ({ ...m, format }))
  );

  const filtered =
    activeFormat === 'ALL'
      ? allMatches
      : allMatches.filter((m) => m.format === activeFormat);

  // Sort by time
  filtered.sort((a, b) => {
    const toMins = (t: string) => {
      if (!t) return 9999;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return toMins(a.Time) - toMins(b.Time);
  });

  // Group by time
  const byTime: Record<string, any[]> = {};
  filtered.forEach((m) => {
    const key = m.Time || 'TBD';
    if (!byTime[key]) byTime[key] = [];
    byTime[key].push(m);
  });

  const getPlayers = (m: any) => ({
    p1: m.Player_1 || m.Players_1 || 'TBD',
    p2: m.Player_2 || m.Players_2 || 'TBD',
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 font-sans text-slate-900">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Match Schedule</h2>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Calendar size={16} />
            Tournament Timeline & Live Updates
          </p>
        </div>
        
        {/* Filter Pills - Modern Segmented Control Style */}
        <div className="bg-slate-100/80 p-1 rounded-xl flex flex-wrap gap-1 border border-slate-200/50 backdrop-blur-sm">
          <button
            onClick={() => setActiveFormat('ALL')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeFormat === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            All Events
          </button>
          {Object.entries(FORMAT_LABELS).map(([code, label]) =>
            tournamentData.formats.includes(code) ? (
              <button
                key={code}
                onClick={() => setActiveFormat(code)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  activeFormat === code
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                {code}
              </button>
            ) : null
          )}
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative">
        {/* Vertical Timeline Line */}
        <div className="absolute left-[31px] md:left-[79px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-slate-200 via-slate-200 to-transparent hidden sm:block" />

        <div className="space-y-10">
          {Object.entries(byTime).map(([time, matches]) => (
            <div key={time} className="relative flex flex-col sm:flex-row gap-4 md:gap-8">
              
              {/* Time Label */}
              <div className="sm:w-20 flex-shrink-0 pt-1">
                <div className="sticky top-8 flex items-center sm:justify-end gap-3">
                  <span className="text-sm font-bold text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded sm:bg-transparent sm:p-0">
                    {time}
                  </span>
                  {/* Timeline Dot for Mobile/Small Screens */}
                  <div className="hidden sm:block w-4 h-4 rounded-full border-4 border-white bg-slate-300 shadow-sm z-10" />
                </div>
              </div>

              {/* Match Cards Group */}
              <div className="flex-1 space-y-4">
                {matches.map((m, idx) => {
                  const { p1, p2 } = getPlayers(m);
                  const isLive = m.Status === 'in-progress';
                  const isDone = m.Status === 'completed';
                  const p1Won = isDone && m.Winner?.includes(p1.split('/')[0]);
                  const p2Won = isDone && m.Winner?.includes(p2.split('/')[0]);
                  const formatStyle = FORMAT_COLORS[m.format] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100', dot: 'bg-slate-400' };
                  const poolGradient = POOL_COLORS[m.Pool] || POOL_COLORS[m.Round] || 'from-white to-white border-slate-200';

                  return (
                    <div
                      key={idx}
                      className={`group relative bg-gradient-to-br ${poolGradient} border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${
                        isLive ? 'ring-2 ring-rose-500 ring-offset-2 shadow-lg shadow-rose-100' : 'shadow-sm'
                      }`}
                    >
                      {/* Live Indicator Bar */}
                      {isLive && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500 animate-pulse" />
                      )}

                      {/* Card Header */}
                      <div className="px-5 py-3 flex items-center justify-between border-b border-black/5 bg-white/40 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                            Match {m.Match_ID}
                          </span>
                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${formatStyle.bg} ${formatStyle.border} ${formatStyle.text} text-[10px] font-black uppercase tracking-wider`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${formatStyle.dot}`} />
                            {FORMAT_LABELS[m.format] || m.format}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                            {m.Pool || m.Round}
                          </span>
                          {isLive ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                              <Activity size={10} /> LIVE
                            </span>
                          ) : isDone ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                              <CheckCircle2 size={10} /> FINISHED
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black">
                              <Clock size={10} /> UPCOMING
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Players & Score Section */}
                      <div className="px-6 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-6">
                          
                          {/* Player 1 */}
                          <div className={`flex flex-col md:items-end gap-1 ${p1Won ? 'scale-105 origin-right transition-transform' : ''}`}>
                            <div className="flex items-center gap-3 md:flex-row-reverse">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${p1Won ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-200' : 'bg-slate-100 text-slate-400'}`}>
                                {p1.charAt(0)}
                              </div>
                              <div className="text-left md:text-right">
                                <p className={`text-base font-bold leading-tight ${p1Won ? 'text-slate-900' : 'text-slate-700'}`}>
                                  {p1}
                                </p>
                                {p1Won && <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1 md:justify-end"><Trophy size={10} /> Winner</span>}
                              </div>
                            </div>
                          </div>

                          {/* VS Separator */}
                          <div className="flex flex-row md:flex-col items-center justify-center gap-3">
                            <div className="h-px w-full md:w-px md:h-8 bg-slate-200" />
                            <span className="text-[10px] font-black text-slate-300 tracking-[0.3em] uppercase">VS</span>
                            <div className="h-px w-full md:w-px md:h-8 bg-slate-200" />
                          </div>

                          {/* Player 2 */}
                          <div className={`flex flex-col items-start gap-1 ${p2Won ? 'scale-105 origin-left transition-transform' : ''}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${p2Won ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-200' : 'bg-slate-100 text-slate-400'}`}>
                                {p2.charAt(0)}
                              </div>
                              <div className="text-left">
                                <p className={`text-base font-bold leading-tight ${p2Won ? 'text-slate-900' : 'text-slate-700'}`}>
                                  {p2}
                                </p>
                                {p2Won && <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1"><Trophy size={10} /> Winner</span>}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Score Display */}
                        {(m.Score_1 || m.Score_2) && (
                          <div className="mt-8 flex justify-center">
                            <div className="inline-flex items-center gap-4 bg-slate-900 text-white px-6 py-2 rounded-2xl shadow-lg shadow-slate-200">
                              <span className={`text-xl font-black font-mono ${p1Won ? 'text-amber-400' : 'text-white'}`}>{m.Score_1 || '0'}</span>
                              <div className="w-px h-4 bg-white/20" />
                              <span className={`text-xl font-black font-mono ${p2Won ? 'text-amber-400' : 'text-white'}`}>{m.Score_2 || '0'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Bottom Action/Link (Optional visual element) */}
                      <div className="px-6 py-2 bg-black/[0.02] flex justify-end">
                         <button className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
                           VIEW DETAILS <ChevronRight size={12} />
                         </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Finals Callout - Premium Redesign */}
      <div className="relative mt-12 overflow-hidden rounded-3xl bg-slate-900 p-8 text-white shadow-2xl shadow-slate-300">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black tracking-widest uppercase mb-4">
              <Trophy size={12} /> Championship Night
            </div>
            <h3 className="text-3xl font-black tracking-tight">The Grand Finals</h3>
            <p className="text-slate-400 mt-2 max-w-md">
              Witness the peak of the tournament as the best players compete for the ultimate glory. Don't miss the action!
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            {[
              { label: 'WS', time: '19:30' },
              { label: 'MD', time: '19:30' },
              { label: 'MS', time: '20:00' },
              { label: 'XD', time: '20:30' }
            ].map((item) => (
              <div key={item.label} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[100px]">
                <span className="text-amber-400 font-black text-lg">{item.label}</span>
                <span className="text-slate-300 font-mono text-sm">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
