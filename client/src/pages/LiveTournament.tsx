import React, { useState, useEffect } from 'react';
import {
  Trophy,
  CalendarClock,
  ClipboardList,
  LayoutList,
  Activity,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ScheduleView } from './ScheduleView';

interface TournamentData {
  formats: string[];
  players: any;
  matches: {
    [format: string]: any[];
  };
  config: any;
  lastUpdated: string;
}

export default function LiveTournament() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'register' | 'brackets' | 'schedule'>('schedule');
  const [activeFormat, setActiveFormat] = useState('MS');
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- DATA FETCHING (LIVE FIREBASE LISTENER) ---
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'live_data', 'tournament'),
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
        console.error('Firebase listen error:', err);
        setError('Failed to connect to live updates.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // --- HELPER FUNCTIONS ---
  const getAllMatches = () => {
    if (!tournamentData) return [];
    return Object.entries(tournamentData.matches).flatMap(([format, matches]) =>
      matches.map((m: any) => ({ ...m, format }))
    );
  };

  const getLiveMatches = () => {
    return getAllMatches().filter((m) => m.Status === 'in-progress');
  };

  const getRecentCompleted = () => {
    return getAllMatches()
      .filter((m) => m.Status === 'completed')
      .slice(-6); // Last 6 completed
  };

  const currentMatches = tournamentData?.matches[activeFormat] || [];
  const rounds = currentMatches.reduce(
    (acc, match) => {
      const roundName = match.Round || 'Unassigned';
      if (!acc[roundName]) acc[roundName] = [];
      acc[roundName].push(match);
      return acc;
    },
    {} as { [key: string]: any[] }
  );

  const liveMatches = getLiveMatches();
  const recentCompleted = getRecentCompleted();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 py-10 px-4">
      {/* --- PAGE HEADER & MASTER TOGGLE --- */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
              <Trophy className="text-yellow-500 w-8 h-8" />
              Live Tournament Dashboard
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
            <div className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-gray-400 text-sm font-bold cursor-not-allowed">
              <ClipboardList size={18} />
              Registration Closed
            </div>
            <button
              onClick={() => setActiveTab('brackets')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'brackets'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <LayoutList size={18} />
              Live Brackets
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'schedule'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Clock size={18} />
              Schedule & Live Scores
            </button>
          </div>
        </div>
      </div>

      {/* --- TAB CONTENT: REGISTRATION --- */}
      {activeTab === 'register' && (
        <div className="max-w-xl mx-auto py-20 text-center text-gray-500">
          <p className="text-5xl mb-4">🏸</p>
          <p className="text-2xl font-bold text-gray-700 mb-2">Registrations Closed</p>
          <p className="text-gray-500">Check the schedule or live brackets below.</p>
        </div>
      )}

      {/* --- TAB CONTENT: BRACKETS --- */}
      {activeTab === 'brackets' && (
        <div className="animate-in fade-in duration-300">
          {loading ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : error || !tournamentData ? (
            <div className="py-20 text-center text-gray-500">
              <p className="text-xl font-bold mb-2">Data Pending 🏸</p>
              <p>{error}</p>
            </div>
          ) : (
            <>
              {/* --- LIVE SCORES SECTION --- */}
              {(liveMatches.length > 0 || recentCompleted.length > 0) && (
                <div className="max-w-7xl mx-auto mb-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Live Matches */}
                    {liveMatches.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-lg border-2 border-red-500 overflow-hidden">
                        <div className="bg-gradient-to-r from-red-500 to-red-600 p-4 text-white flex items-center justify-between">
                          <h3 className="font-black text-lg flex items-center gap-2">
                            <Activity className="animate-pulse" size={20} />
                            LIVE NOW
                          </h3>
                          <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full text-sm">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            {liveMatches.length} Match{liveMatches.length !== 1 ? 'es' : ''}
                          </div>
                        </div>
                        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                          {liveMatches.map((match: any, idx: number) => (
                            <LiveMatchCard key={idx} match={match} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Results */}
                    {recentCompleted.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 text-white flex items-center justify-between">
                          <h3 className="font-black text-lg flex items-center gap-2">
                            <CheckCircle size={20} />
                            RECENT RESULTS
                          </h3>
                        </div>
                        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                          {recentCompleted.map((match: any, idx: number) => (
                            <CompletedMatchCard key={idx} match={match} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bracket Format Sub-Tabs */}
              <div className="max-w-7xl mx-auto mb-6 flex flex-wrap gap-2">
                {[...tournamentData.formats]
                  .sort(
                    (a, b) =>
                      ['MS', 'WS', 'MD', 'WD', 'XD'].indexOf(a) -
                      ['MS', 'WS', 'MD', 'WD', 'XD'].indexOf(b)
                  )
                  .map((format) => (
                    <button
                      key={format}
                      onClick={() => setActiveFormat(format)}
                      className={`px-6 py-2 rounded-full font-bold transition-all shadow-sm ${activeFormat === format
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
                    <div className="text-center py-20 text-gray-400 italic">
                      No matches scheduled for {activeFormat} yet.
                    </div>
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
                              const p1Won =
                                isCompleted &&
                                match.Winner &&
                                match.Winner.includes(p1Name.split('/')[0]);
                              const p2Won =
                                isCompleted &&
                                match.Winner &&
                                match.Winner.includes(p2Name.split('/')[0]);

                              return (
                                <div
                                  key={matchIdx}
                                  className={`border rounded-xl overflow-hidden bg-white ${isLive ? 'border-red-500 shadow-lg shadow-red-200 ring-2 ring-red-200' : 'border-gray-200 shadow-sm'}`}
                                >
                                  <div
                                    className={`px-3 py-1.5 text-xs font-semibold flex justify-between items-center ${isLive ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}
                                  >
                                    <span>{match.Match_ID}</span>
                                    {isLive ? (
                                      <span className="animate-pulse flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span>{' '}
                                        LIVE
                                      </span>
                                    ) : (
                                      <span>{match.Status}</span>
                                    )}
                                  </div>
                                  <div
                                    className={`p-3 flex justify-between items-center border-b ${p1Won ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-gray-700'}`}
                                  >
                                    <span className="truncate pr-2">{p1Name}</span>
                                    {p1Won && (
                                      <Trophy
                                        size={14}
                                        className="text-emerald-600 flex-shrink-0"
                                      />
                                    )}
                                  </div>
                                  {match.Score_1 && (
                                    <div className="text-center py-1 bg-gray-50 text-xs font-mono font-bold text-gray-600">
                                      {match.Score_1}
                                    </div>
                                  )}
                                  <div
                                    className={`p-3 flex justify-between items-center ${p2Won ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-gray-700'} ${match.Score_1 ? 'border-t' : ''}`}
                                  >
                                    <span className="truncate pr-2">{p2Name}</span>
                                    {p2Won && (
                                      <Trophy
                                        size={14}
                                        className="text-emerald-600 flex-shrink-0"
                                      />
                                    )}
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
      {activeTab === 'schedule' && (
        <div className="max-w-4xl mx-auto px-4 py-8">
          <ScheduleView tournamentData={tournamentData} />
        </div>
      )}
    </div>
  );
}

// --- LIVE MATCH CARD COMPONENT ---
function LiveMatchCard({ match }: { match: any }) {
  const p1Name = match.Player_1 || match.Players_1 || 'TBD';
  const p2Name = match.Player_2 || match.Players_2 || 'TBD';
  const scores = match.Score_1 ? match.Score_1.split(',').map((s: string) => s.trim()) : [];

  return (
    <div className="border-2 border-red-200 rounded-xl overflow-hidden bg-red-50/50 hover:shadow-md transition-shadow">
      <div className="bg-red-100 px-3 py-2 flex items-center justify-between">
        <span className="font-bold text-sm text-red-900">
          {match.format} - {match.Match_ID}
        </span>
        <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-bold flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
          LIVE
        </span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-gray-800">{p1Name}</span>
          <div className="flex gap-1">
            {scores.map((scoreSet, idx) => {
              const [s1] = scoreSet.split('-').map((s) => parseInt(s.trim()) || 0);
              return (
                <div
                  key={idx}
                  className="bg-white border border-gray-300 px-2 py-1 rounded text-xs font-bold min-w-[28px] text-center"
                >
                  {s1}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold text-gray-800">{p2Name}</span>
          <div className="flex gap-1">
            {scores.map((scoreSet, idx) => {
              const [, s2] = scoreSet.split('-').map((s) => parseInt(s.trim()) || 0);
              return (
                <div
                  key={idx}
                  className="bg-white border border-gray-300 px-2 py-1 rounded text-xs font-bold min-w-[28px] text-center"
                >
                  {s2}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- COMPLETED MATCH CARD COMPONENT ---
function CompletedMatchCard({ match }: { match: any }) {
  const p1Name = match.Player_1 || match.Players_1 || 'TBD';
  const p2Name = match.Player_2 || match.Players_2 || 'TBD';
  const p1Won = match.Winner && match.Winner.includes(p1Name.split('/')[0]);
  const p2Won = match.Winner && match.Winner.includes(p2Name.split('/')[0]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-white">
      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
        <span className="font-bold text-sm text-gray-700">
          {match.format} - {match.Match_ID}
        </span>
        <CheckCircle size={16} className="text-emerald-500" />
      </div>
      <div className="p-3 space-y-1">
        <div
          className={`flex justify-between items-center ${p1Won ? 'font-bold text-emerald-700' : 'text-gray-600'}`}
        >
          <span className="flex items-center gap-1">
            {p1Won && <Trophy size={14} className="text-yellow-500" />}
            {p1Name}
          </span>
        </div>
        {match.Score_1 && (
          <div className="text-center py-1 text-xs font-mono text-gray-500 bg-gray-50 rounded">
            {match.Score_1}
          </div>
        )}
        <div
          className={`flex justify-between items-center ${p2Won ? 'font-bold text-emerald-700' : 'text-gray-600'}`}
        >
          <span className="flex items-center gap-1">
            {p2Won && <Trophy size={14} className="text-yellow-500" />}
            {p2Name}
          </span>
        </div>
      </div>
    </div>
  );
}
