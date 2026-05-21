import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Calendar, MapPin, Users, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';

type BracketMatch = { player1: string; player2: string; winner?: string; score?: string };
type BracketRound = { label: string; matches: BracketMatch[] };

function generateEmptyBracket(size: number): BracketRound[] {
  const rounds: BracketRound[] = [];
  let currentSize = size;
  let roundNum = 1;
  
  while (currentSize >= 2) {
    const matchCount = currentSize / 2;
    const matches: BracketMatch[] = Array.from({ length: matchCount }).map(() => ({
      player1: 'TBD',
      player2: 'TBD',
    }));
    
    let label = `Round ${roundNum}`;
    if (currentSize === 8) label = 'Quarterfinals';
    if (currentSize === 4) label = 'Semifinals';
    if (currentSize === 2) label = 'Final';
    
    rounds.push({ label, matches });
    currentSize /= 2;
    roundNum++;
  }
  
  return rounds;
}

function BracketViewer({ rounds }: { rounds: BracketRound[] }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max">
        {rounds.map((round, ri) => (
          <div key={ri} className="flex flex-col gap-4 min-w-[220px]">
            <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center mb-2">
              {round.label}
            </h4>
            <div className="flex-1 flex flex-col justify-around gap-6">
              {round.matches.map((match, mi) => (
                <div key={mi} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm text-sm">
                  {[match.player1, match.player2].map((player, pi) => (
                    <div
                      key={pi}
                      className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-b-0 flex justify-between items-center bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 italic"
                    >
                      <span className="truncate max-w-[150px]">{player}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Invicta() {
  const [bracketSize, setBracketSize] = useState<number>(16);
  const [format, setFormat] = useState('MS');
  const dummyBracket = generateEmptyBracket(bracketSize);

  return (
    <div className="py-12 bg-slate-50 dark:bg-slate-900 min-h-[calc(100vh-80px)]">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-blue-900 p-12 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            <Trophy className="w-20 h-20 mx-auto mb-6 text-emerald-300 relative z-10" />
            <h1 className="text-4xl md:text-6xl font-extrabold mb-4 tracking-tight relative z-10">
              INVICTA 2026
            </h1>
            <p className="text-emerald-100 text-xl md:text-2xl font-medium max-w-2xl mx-auto relative z-10">
              The Ultimate IISc Badminton Showdown
            </p>
          </div>

          {/* Content */}
          <div className="p-8 md:p-12">
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center text-center border border-slate-100 dark:border-slate-700">
                <Calendar className="w-10 h-10 text-emerald-500 mb-4" />
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-1">Dates</h3>
                <p className="text-slate-600 dark:text-slate-400">1st June - 21st June (Tentative)</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center text-center border border-slate-100 dark:border-slate-700">
                <MapPin className="w-10 h-10 text-emerald-500 mb-4" />
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-1">Venue</h3>
                <p className="text-slate-600 dark:text-slate-400">Gymkhana Badminton Courts</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center text-center border border-slate-100 dark:border-slate-700">
                <Users className="w-10 h-10 text-emerald-500 mb-4" />
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-1">Categories</h3>
                <p className="text-slate-600 dark:text-slate-400">MS, WS, MD, WD, XD</p>
              </div>
            </div>

            <div className="text-center bg-emerald-50 dark:bg-emerald-950/30 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/50">
              <h2 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-emerald-400 mb-4">
                Registrations are now open!
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-8 max-w-2xl mx-auto text-lg">
                Don't miss the chance to compete and showcase your skills. The form is restricted to IISc members.
                <br />
                <strong className="text-rose-600 dark:text-rose-400">Deadline: 26 May 2026</strong>
              </p>
              
              <a href="https://forms.cloud.microsoft/r/c82F9mgTv5" target="_blank" rel="noopener noreferrer">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all gap-3">
                  <span>Register Now (Microsoft Form)</span>
                </Button>
              </a>
            </div>
            
            <div className="mt-12 text-center text-slate-500 dark:text-slate-400">
              <p>More details regarding fixtures, rules, and brackets will be updated here soon.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
