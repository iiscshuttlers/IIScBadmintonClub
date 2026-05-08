// ScheduleView.tsx
// Add this as a third tab in FarewellTournament.tsx
// Import and use: <ScheduleView tournamentData={tournamentData} />

import { Clock, Trophy } from 'lucide-react';

const FORMAT_LABELS: Record<string, string> = {
  MS: 'Men\'s Singles',
  WS: 'Women\'s Singles',
  MD: 'Men\'s Doubles',
  WD: 'Women\'s Doubles',
  XD: 'Mixed Doubles',
};

const FORMAT_COLORS: Record<string, string> = {
  MS: 'bg-blue-100 text-blue-800 border-blue-200',
  WS: 'bg-pink-100 text-pink-800 border-pink-200',
  MD: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  WD: 'bg-purple-100 text-purple-800 border-purple-200',
  XD: 'bg-orange-100 text-orange-800 border-orange-200',
};

const POOL_COLORS: Record<string, string> = {
  'Finals':   'bg-yellow-50 border-yellow-300',
  'League A': 'bg-blue-50 border-blue-200',
  'League B': 'bg-emerald-50 border-emerald-200',
  'League':   'bg-slate-50 border-slate-200',
  'KO':       'bg-red-50 border-red-200',
};

interface ScheduleViewProps {
  tournamentData: any;
}

export function ScheduleView({ tournamentData }: ScheduleViewProps) {
  if (!tournamentData) return null;

  // Flatten all matches with format tag + sort by Time
  const allMatches = Object.entries(tournamentData.matches).flatMap(
    ([format, matches]: [string, any]) =>
      (matches as any[]).map((m) => ({ ...m, format }))
  );

  allMatches.sort((a, b) => {
    const toMins = (t: string) => {
      if (!t) return 9999;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return toMins(a.Time) - toMins(b.Time);
  });

  // Group by time slot
  const byTime: Record<string, any[]> = {};
  allMatches.forEach((m) => {
    const key = m.Time || 'TBD';
    if (!byTime[key]) byTime[key] = [];
    byTime[key].push(m);
  });

  const getPlayers = (m: any) => ({
    p1: m.Player_1 || m.Players_1 || 'TBD',
    p2: m.Player_2 || m.Players_2 || 'TBD',
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'in-progress': return 'bg-red-500 text-white animate-pulse';
      case 'completed':   return 'bg-emerald-500 text-white';
      default:            return 'bg-gray-200 text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in-progress': return '● LIVE';
      case 'completed':   return '✓ Done';
      default:            return 'Upcoming';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-2 animate-in fade-in duration-300">

      {/* Legend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-2 justify-center">
          {Object.entries(FORMAT_LABELS).map(([code, label]) =>
            tournamentData.formats.includes(code) ? (
              <span key={code} className={`px-3 py-1 rounded-full text-xs font-bold border ${FORMAT_COLORS[code] || 'bg-gray-100 text-gray-700'}`}>
                {code} — {label}
              </span>
            ) : null
          )}
        </div>
      </div>

      {/* Timeline */}
      {Object.entries(byTime).map(([time, matches]) => (
        <div key={time} className="flex gap-4 items-start">

          {/* Time column */}
          <div className="w-16 flex-shrink-0 pt-3 text-right">
            <span className="text-sm font-black text-gray-700 font-mono">{time}</span>
          </div>

          {/* Dot */}
          <div className="flex flex-col items-center pt-4 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100 flex-shrink-0" />
            <div className="w-0.5 bg-gray-200 flex-1 mt-1" style={{ minHeight: '100%' }} />
          </div>

          {/* Match cards */}
          <div className="flex-1 pb-4 space-y-2">
            {matches.map((m, idx) => {
              const { p1, p2 } = getPlayers(m);
              const isLive = m.Status === 'in-progress';
              const isDone = m.Status === 'completed';
              const poolStyle = POOL_COLORS[m.Pool] || POOL_COLORS[m.Round] || 'bg-white border-gray-200';

              return (
                <div
                  key={idx}
                  className={`border rounded-2xl overflow-hidden transition-shadow ${
                    isLive ? 'border-red-400 shadow-lg shadow-red-100 ring-2 ring-red-200' : `${poolStyle}`
                  }`}
                >
                  {/* Card header */}
                  <div className={`px-4 py-2 flex items-center justify-between ${isLive ? 'bg-red-50' : 'bg-white/60'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-gray-500 text-xs">{m.Match_ID}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${FORMAT_COLORS[m.format] || 'bg-gray-100 text-gray-600'}`}>
                        {m.format}
                      </span>
                      <span className="text-xs text-gray-400">{m.Pool || m.Round}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusStyle(m.Status)}`}>
                      {getStatusLabel(m.Status)}
                    </span>
                  </div>

                  {/* Players */}
                  <div className="px-4 py-3 space-y-1">
                    <div className={`flex justify-between items-center ${isDone && m.Winner?.includes(p1.split('/')[0]) ? 'font-bold text-emerald-700' : 'text-gray-800'}`}>
                      <span className="text-sm">{p1}</span>
                      {isDone && m.Winner?.includes(p1.split('/')[0]) && <Trophy size={13} className="text-yellow-500 flex-shrink-0" />}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-xs text-gray-400 font-bold">VS</span>
                      {m.Score_1 && <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{m.Score_1}</span>}
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    <div className={`flex justify-between items-center ${isDone && m.Winner?.includes(p2.split('/')[0]) ? 'font-bold text-emerald-700' : 'text-gray-800'}`}>
                      <span className="text-sm">{p2}</span>
                      {isDone && m.Winner?.includes(p2.split('/')[0]) && <Trophy size={13} className="text-yellow-500 flex-shrink-0" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Finals callout */}
      <div className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-5 text-center">
        <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
        <p className="font-black text-gray-800 text-lg">Finals Night</p>
        <p className="text-gray-600 text-sm mt-1">WS: 19:30 · MD: 19:30 · MS: 20:00 · XD: 20:30</p>
      </div>
    </div>
  );
}
