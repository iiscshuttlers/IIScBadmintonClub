import React, { useState, useEffect } from 'react';
import { Trophy, Clock, CheckCircle, Circle } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from "firebase/firestore";

export default function TournamentBracket() {
  const [data, setData] = useState<any>(null);
  const [selectedFormat, setSelectedFormat] = useState('MS');

  useEffect(() => {
    const unsubData = onSnapshot(doc(db, "live_data", "tournament"), (docSnap) => {
      if (docSnap.exists()) setData(docSnap.data());
    });
    return () => unsubData();
  }, []);

  if (!data) return <div className="text-center mt-20 font-bold animate-pulse">Loading Bracket...</div>;

  const matches = data.matches[selectedFormat] || [];
  
  // Group matches by round
  const rounds = groupMatchesByRound(matches);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <Trophy className="text-yellow-400" size={32} />
                {data.config.eventName}
              </h1>
              <p className="text-slate-300 mt-1">{data.config.venue}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase tracking-wide">Last Updated</div>
              <div className="text-sm text-white font-mono">
                {new Date(data.lastUpdated).toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* Format Tabs */}
          <div className="flex flex-wrap gap-2">
            {data.formats.map((format: string) => (
              <button
                key={format}
                onClick={() => setSelectedFormat(format)}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                  selectedFormat === format
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50 scale-105'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {formatName(format)}
              </button>
            ))}
          </div>
        </div>

        {/* Bracket */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 overflow-x-auto">
          <BracketView rounds={rounds} format={selectedFormat} />
        </div>
      </div>
    </div>
  );
}

function groupMatchesByRound(matches: any[]) {
  const roundOrder = ['Round 1', 'Round 2', 'Quarterfinals', 'Semifinals', 'Final'];
  const grouped: { [key: string]: any[] } = {};
  
  matches.forEach(match => {
    const round = match.Round;
    if (!grouped[round]) grouped[round] = [];
    grouped[round].push(match);
  });
  
  // Return in proper order
  return roundOrder.filter(r => grouped[r]).map(r => ({
    name: r,
    matches: grouped[r]
  }));
}

function BracketView({ rounds, format }: { rounds: any[], format: string }) {
  const isDoubles = ['MD', 'WD', 'XD'].includes(format);
  
  return (
    <div className="flex gap-8 min-w-max">
      {rounds.map((round, roundIdx) => (
        <div key={round.name} className="flex flex-col justify-around min-w-[280px]">
          {/* Round Header */}
          <div className="text-center mb-6 sticky top-0 bg-slate-900/80 backdrop-blur-sm py-3 rounded-xl border border-white/10">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Round {roundIdx + 1}</div>
            <div className="text-lg font-black text-white">{round.name}</div>
            <div className="text-xs text-emerald-400 mt-1">
              {round.matches.filter((m: any) => m.Status === 'completed').length}/{round.matches.length} Complete
            </div>
          </div>

          {/* Matches */}
          <div className="space-y-6 flex-1 flex flex-col justify-around">
            {round.matches.map((match: any) => (
              <MatchCard key={match.Match_ID} match={match} isDoubles={isDoubles} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchCard({ match, isDoubles }: { match: any, isDoubles: boolean }) {
  const player1 = isDoubles ? match.Players_1 : match.Player_1;
  const player2 = isDoubles ? match.Players_2 : match.Player_2;
  
  const isCompleted = match.Status === 'completed';
  const isLive = match.Status === 'in-progress';
  const winner = match.Winner;
  
  // Parse score
  const scores = match.Score_1 ? match.Score_1.split(',').map((s: string) => s.trim()) : [];
  
  return (
    <div className={`relative bg-white/10 backdrop-blur-sm rounded-xl border-2 transition-all ${
      isLive ? 'border-red-500 shadow-lg shadow-red-500/30 animate-pulse' :
      isCompleted ? 'border-emerald-500/50' : 'border-white/20'
    }`}>
      
      {/* Match ID Badge */}
      <div className="absolute -top-3 -left-3 bg-slate-800 text-slate-300 text-xs font-mono px-3 py-1 rounded-full border border-white/20">
        {match.Match_ID}
      </div>

      {/* Status Badge */}
      <div className="absolute -top-3 -right-3">
        {isLive && (
          <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
            <Circle className="fill-white" size={8} /> LIVE
          </div>
        )}
        {isCompleted && (
          <div className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircle size={12} /> DONE
          </div>
        )}
        {!isLive && !isCompleted && (
          <div className="bg-slate-600 text-slate-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <Clock size={12} /> PENDING
          </div>
        )}
      </div>

      <div className="p-4 pt-6">
        {/* Player 1 */}
        <PlayerRow 
          name={player1} 
          scores={scores} 
          isWinner={winner === player1}
          isCompleted={isCompleted}
        />
        
        <div className="my-2 border-t border-white/20"></div>
        
        {/* Player 2 */}
        <PlayerRow 
          name={player2} 
          scores={scores} 
          isWinner={winner === player2}
          isCompleted={isCompleted}
          isPlayer2={true}
        />
      </div>
    </div>
  );
}

function PlayerRow({ 
  name, 
  scores, 
  isWinner, 
  isCompleted,
  isPlayer2 = false 
}: { 
  name: string, 
  scores: string[], 
  isWinner: boolean, 
  isCompleted: boolean,
  isPlayer2?: boolean 
}) {
  const isBye = name === 'Bye';
  const isTBD = name === 'TBD';
  
  return (
    <div className={`flex items-center justify-between gap-2 ${
      isWinner ? 'bg-emerald-500/20 rounded-lg px-3 py-2 border border-emerald-500/50' : ''
    }`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isWinner && <Trophy className="text-yellow-400 flex-shrink-0" size={16} />}
        <span className={`font-bold truncate ${
          isTBD ? 'text-slate-500 italic' :
          isBye ? 'text-slate-600 italic' :
          isWinner ? 'text-white' : 'text-slate-300'
        }`}>
          {name}
        </span>
      </div>
      
      {/* Score Display */}
      {scores.length > 0 && !isTBD && !isBye && (
        <div className="flex gap-1 flex-shrink-0">
          {scores.map((scoreSet, idx) => {
            const [s1, s2] = scoreSet.split('-').map(s => parseInt(s.trim()) || 0);
            const score = isPlayer2 ? s2 : s1;
            const wonSet = isPlayer2 ? s2 > s1 : s1 > s2;
            
            return (
              <div 
                key={idx}
                className={`px-2 py-1 rounded text-xs font-bold min-w-[32px] text-center ${
                  wonSet ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {score}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatName(code: string) {
  const names: { [key: string]: string } = {
    'MS': "Men's Singles",
    'WS': "Women's Singles",
    'MD': "Men's Doubles",
    'WD': "Women's Doubles",
    'XD': "Mixed Doubles"
  };
  return names[code] || code;
}
