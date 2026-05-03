import React, { useState, useEffect } from 'react';
import { Trophy, CalendarClock, ClipboardList, LayoutList } from 'lucide-react';
// 1. ADDED FIREBASE IMPORTS HERE
import { db } from '../lib/firebase';
import { doc, onSnapshot } from "firebase/firestore";

interface TournamentData {
  formats: string[];
  players: any;
  matches: {
    [format: string]: any[];
  };
  config: any;
  lastUpdated: string;
}

export default function FarewellTournament() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'register' | 'brackets'>('register');
  const [activeFormat, setActiveFormat] = useState('MS');
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- DATA FETCHING (LIVE FIREBASE LISTENER) ---
  useEffect(() => {
    // 2. REPLACED FETCH WITH FIREBASE ONSNAPSHOT
    const unsubscribe = onSnapshot(doc(db, "live_data", "tournament"), 
      (docSnap) => {
        if (docSnap.exists()) {
          setTournamentData(docSnap.data() as TournamentData);
          setLoading(false);
          setError('');
        } else {
          setError('Tournament brackets are not available yet.');
          setLoading(false);
        }
      },
      (err) => {
        console.error("Firebase listen error:", err);
        setError('Failed to connect to live updates.');
        setLoading(false);
      }
    );

    // Cleanup listener when component unmounts
    return () => unsubscribe();
  }, []);

  // --- BRACKET HELPER LOGIC ---
  const currentMatches = tournamentData?.matches[activeFormat] || [];
  const rounds = currentMatches.reduce((acc, match) => {
    const roundName = match.Round || "Unassigned";
    if (!acc[roundName]) acc[roundName] = [];
    acc[roundName].push(match);
    return acc;
  }, {} as { [key: string]: any[] });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 py-10 px-4">
      
      {/* --- PAGE HEADER & MASTER TOGGLE --- */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
              <Trophy className="text-yellow-500 w-8 h-8" />
              Farewell Tournament 2026
            </h1>
            {tournamentData && tournamentData.lastUpdated && (
              <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                <CalendarClock size={16} />
                Scores updated: {new Date(tournamentData.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>

          {/* View Toggle Buttons */}
          <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'register'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardList size={18} />
              Registration
            </button>
            <button
              onClick={() => setActiveTab('brackets')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'brackets'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutList size={18} />
              Live Brackets
            </button>
          </div>
        </div>
      </div>

      {/* --- TAB CONTENT: REGISTRATION --- */}
      {activeTab === 'register' && (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-blue-600 to-teal-500 rounded-2xl shadow-xl overflow-hidden p-8 text-center text-white mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Scan to Register Instantly</h2>
            <img
              src={`${import.meta.env.BASE_URL || '/'}farewell-qr.png`}
              alt="Scan to Register"
              className="w-64 mx-auto rounded-xl shadow-lg bg-white p-3 mb-6 hover:scale-105 transition-transform"
            />
            <p className="text-lg opacity-90 mb-6">— OR —</p>
            <a
              href="https://forms.office.com/Pages/ResponsePage.aspx?id=l80Vb6f240Gyxa1Bk5dkdjlbEJEXeeNOpPakbLe44QpUME1XNlgyTzYwQThTTEVIWEdKNU03MzlHRC4u"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-blue-700 px-8 py-3 rounded-xl font-bold hover:bg-gray-50 transition shadow-md"
            >
              Open Registration Form
            </a>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 p-4 border-b font-semibold text-gray-700 text-center">
              Direct Form Embed
            </div>
            <iframe
              src="https://forms.office.com/Pages/ResponsePage.aspx?id=l80Vb6f240Gyxa1Bk5dkdjlbEJEXeeNOpPakbLe44QpUME1XNlgyTzYwQThTTEVIWEdKNU03MzlHRC4u&embed=true"
              className="w-full h-[600px]"
              frameBorder="0"
              title="Farewell Match Registration"
            />
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: BRACKETS --- */}
      {activeTab === 'brackets' && (
        <div className="animate-in fade-in duration-300">
          
          {loading ? (
             <div className="py-20 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>
          ) : error || !tournamentData ? (
            <div className="py-20 text-center text-gray-500">
              <p className="text-xl font-bold mb-2">Data Pending 🏸</p>
              <p>{error}</p>
            </div>
          ) : (
            <>
              {/* Bracket Format Sub-Tabs */}
              <div className="max-w-7xl mx-auto mb-6 flex flex-wrap gap-2">
                {[...tournamentData.formats]
                  .sort((a, b) => ['MS', 'WS', 'MD', 'WD', 'XD'].indexOf(a) - ['MS', 'WS', 'MD', 'WD', 'XD'].indexOf(b))
                  .map(format => (
                  <button
                    key={format}
                    onClick={() => setActiveFormat(format)}
                    className={`px-6 py-2 rounded-full font-bold transition-all shadow-sm ${
                      activeFormat === format
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>

              {/* Bracket Board */}
              <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-8 overflow-x-auto">
                  {currentMatches.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 italic">No matches scheduled for {activeFormat} yet.</div>
                  ) : (
                    <div className="flex gap-12 min-w-max">
                      {Object.keys(rounds).map((roundName, idx) => (
                        <div key={idx} className="flex flex-col w-72">
                          <h3 className="text-center font-black text-gray-400 uppercase tracking-widest text-sm mb-6 bg-gray-100 py-2 rounded">
                            {roundName}
                          </h3>
                          <div className="flex flex-col gap-6 justify-around h-full">
                            {rounds[roundName].map((match: any, matchIdx: number) => {
                              const isCompleted = match.Status === 'completed';
                              const isLive = match.Status === 'in-progress';
                              const p1Name = match.Player_1 || match.Players_1 || 'TBD';
                              const p2Name = match.Player_2 || match.Players_2 || 'TBD';
                              const p1Won = isCompleted && match.Winner && match.Winner.includes(p1Name.split('/')[0]);
                              const p2Won = isCompleted && match.Winner && match.Winner.includes(p2Name.split('/')[0]);

                              return (
                                <div key={matchIdx} className={`border rounded-xl overflow-hidden bg-white ${isLive ? 'border-yellow-400 shadow-md' : 'border-gray-200 shadow-sm'}`}>
                                  <div className={`px-3 py-1.5 text-xs font-semibold flex justify-between items-center ${isLive ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-500'}`}>
                                    <span>{match.Match_ID}</span>
                                    {isLive ? <span className="animate-pulse flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> LIVE</span> : <span>{match.Status}</span>}
                                  </div>
                                  <div className={`p-3 flex justify-between items-center border-b ${p1Won ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-gray-700'}`}>
                                    <span className="truncate pr-2">{p1Name}</span>
                                    {p1Won && <Trophy size={14} className="text-emerald-600 flex-shrink-0" />}
                                  </div>
                                  {match.Score_1 && (
                                    <div className="text-center py-1 bg-gray-50 text-xs font-mono font-bold text-gray-600">{match.Score_1}</div>
                                  )}
                                  <div className={`p-3 flex justify-between items-center ${p2Won ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-gray-700'} ${match.Score_1 ? 'border-t' : ''}`}>
                                    <span className="truncate pr-2">{p2Name}</span>
                                    {p2Won && <Trophy size={14} className="text-emerald-600 flex-shrink-0" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}