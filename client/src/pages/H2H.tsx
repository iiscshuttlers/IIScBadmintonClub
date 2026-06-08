import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Swords, Trophy, Activity, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function H2H() {
  const [players, setPlayers] = useState<any[]>([]);
  const [p1Id, setP1Id] = useState<string>('');
  const [p2Id, setP2Id] = useState<string>('');
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('players').select('*').then(({ data }) => {
      if (data) {
        setPlayers(data.sort((a,b) => b.elo_rating - a.elo_rating));
        if (data.length >= 2) {
          setP1Id(data[0].id);
          setP2Id(data[1].id);
        }
      }
      setLoading(false);
    });
    
    supabase.from('matches').select('*').eq('status', 'confirmed').then(({ data }) => {
      if (data) setMatches(data);
    });
  }, []);

  const h2hMatches = useMemo(() => {
    if (!p1Id || !p2Id || !matches.length) return [];
    return matches.filter(m => 
      ((m.player1_id === p1Id && m.player2_id === p2Id) || (m.player1_id === p2Id && m.player2_id === p1Id)) ||
      ((m.player1_id === p1Id || m.team1_partner_id === p1Id) && (m.player2_id === p2Id || m.team2_partner_id === p2Id)) ||
      ((m.player2_id === p1Id || m.team2_partner_id === p1Id) && (m.player1_id === p2Id || m.team1_partner_id === p2Id))
    ).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [matches, p1Id, p2Id]);

  const topRivalries = useMemo(() => {
    if (!matches.length || !players.length) return [];
    
    const pairCounts: Record<string, { p1: string, p2: string, count: number, matches: any[] }> = {};
    
    matches.forEach(m => {
      if (m.team1_partner_id || m.team2_partner_id) return; // Skip doubles for pure rivalries
      const pid1 = m.player1_id;
      const pid2 = m.player2_id;
      if (!pid1 || !pid2) return;
      
      const key = pid1 < pid2 ? `${pid1}_${pid2}` : `${pid2}_${pid1}`;
      if (!pairCounts[key]) pairCounts[key] = { p1: pid1, p2: pid2, count: 0, matches: [] };
      pairCounts[key].count++;
      pairCounts[key].matches.push(m);
    });

    return Object.values(pairCounts)
      .filter(r => r.count > 1) // Must have played at least twice
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [matches, players]);

  const p1Wins = h2hMatches.filter(m => m.winner_id === p1Id || (m.winner_id && m.team1_partner_id === p1Id && m.winner_id === m.player1_id)).length;
  const p2Wins = h2hMatches.length - p1Wins;

  const p1 = players.find(p => p.id === p1Id);
  const p2 = players.find(p => p.id === p2Id);

  const p1WinProb = useMemo(() => {
    if (!p1 || !p2 || p1.elo_rating === undefined || p2.elo_rating === undefined) return 50;
    return Math.round((1 / (1 + Math.pow(10, (p2.elo_rating - p1.elo_rating) / 400))) * 100);
  }, [p1, p2]);
  const p2WinProb = 100 - p1WinProb;

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex justify-center py-20"><Activity className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 pt-6 px-4 md:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition">
            <ArrowLeft className="w-4 h-4" /> Back to Base
          </a>
        </Link>
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-2">
            <Swords className="w-8 h-8 text-emerald-500" /> Head-to-Head
          </h1>
          <p className="text-slate-500 font-medium mt-2">Compare player records</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-lg">
                <img src={p1?.avatar_url || ''} className="w-full h-full object-cover" />
              </div>
              <select value={p1Id} onChange={e => setP1Id(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-bold text-slate-800 dark:text-slate-200 text-center">
                {players.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              <div className="text-sm font-black text-slate-400">ELO: <span className="text-emerald-500">{p1?.elo_rating}</span></div>
            </div>

            <div className="flex flex-col items-center w-full">
              <div className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-2">
                {p1Wins} <span className="text-slate-300 dark:text-slate-700">-</span> {p2Wins}
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{h2hMatches.length} Matches Played</div>
              
              {/* Win Probability Predictor */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mb-2 flex items-center justify-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-500" /> Win Probability
                </div>
                <div className="flex justify-between text-xs font-bold mb-1.5 px-1">
                  <span className="text-emerald-600 dark:text-emerald-400">{p1WinProb}%</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{p2WinProb}%</span>
                </div>
                <div className="h-2.5 w-full bg-indigo-500/20 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${p1WinProb}%` }} />
                  <div className="h-full bg-indigo-500 transition-all duration-1000 ease-out" style={{ width: `${p2WinProb}%` }} />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-lg">
                <img src={p2?.avatar_url || ''} className="w-full h-full object-cover" />
              </div>
              <select value={p2Id} onChange={e => setP2Id(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-bold text-slate-800 dark:text-slate-200 text-center">
                {players.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              <div className="text-sm font-black text-slate-400">ELO: <span className="text-emerald-500">{p2?.elo_rating}</span></div>
            </div>

          </div>
        </div>

        {h2hMatches.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Match History</h3>
            {h2hMatches.map((m, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{new Date(m.created_at).toLocaleDateString()}</div>
                <div className="text-xl font-black bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-lg">{m.score.split(" | ")[0]}</div>
                <div className={`text-sm font-bold flex items-center gap-1 ${m.winner_id === p1Id ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {m.winner_id === p1Id ? <Trophy className="w-4 h-4"/> : ''} {m.winner_id === p1Id ? p1?.full_name : p2?.full_name} Won
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Top Rivalries */}
        {topRivalries.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 mt-8">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-500" /> Club-Wide Top Rivalries
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topRivalries.map((r, i) => {
                const player1 = players.find(p => p.id === r.p1);
                const player2 = players.find(p => p.id === r.p2);
                if (!player1 || !player2) return null;
                const p1Wins = r.matches.filter(m => m.winner_id === r.p1).length;
                const p2Wins = r.count - p1Wins;
                
                return (
                  <div key={i} 
                    onClick={() => { setP1Id(r.p1); setP2Id(r.p2); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    <div className="flex flex-col items-center flex-1">
                      <img src={player1.avatar_url} className="w-10 h-10 rounded-full mb-1 object-cover" />
                      <span className="text-xs font-bold text-center line-clamp-1">{player1.full_name}</span>
                    </div>
                    
                    <div className="flex flex-col items-center px-4">
                      <div className="text-lg font-black text-slate-800 dark:text-slate-200">
                        {p1Wins} <span className="text-slate-400">-</span> {p2Wins}
                      </div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{r.count} matches</span>
                    </div>
                    
                    <div className="flex flex-col items-center flex-1">
                      <img src={player2.avatar_url} className="w-10 h-10 rounded-full mb-1 object-cover" />
                      <span className="text-xs font-bold text-center line-clamp-1">{player2.full_name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
