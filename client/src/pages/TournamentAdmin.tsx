import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import { Activity, Lock, LogOut, Trophy, Plus, Minus, PlusCircle } from 'lucide-react';
import { advanceWinners } from '../lib/tournamentProgression';
import { isAdminEmail } from '../lib/admin';

export default function TournamentAdmin() {
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);

  const [selectedFormat, setSelectedFormat] = useState('MS');
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [status, setStatus] = useState('in-progress');
  const [winner, setWinner] = useState('');

  const [scores, setScores] = useState<{ p1: number; p2: number }[]>([{ p1: 0, p2: 0 }]);
  const [activeSet, setActiveSet] = useState(0);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !isAdminEmail(currentUser.email)) {
        await signOut(auth);
        setUser(null);
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubData = onSnapshot(doc(db, 'live_data', 'tournament'), (docSnap) => {
      if (docSnap.exists()) setData(docSnap.data());
    });
    return () => unsubData();
  }, [user]);

  useEffect(() => {
    if (!data || !selectedMatchId) {
      setScores([{ p1: 0, p2: 0 }]);
      setActiveSet(0);
      return;
    }
    const match = data.matches[selectedFormat].find((m: any) => m.Match_ID === selectedMatchId);

    if (match) {
      setStatus(match.Status || 'in-progress');
      setWinner(match.Winner || '');

      if (match.Score_1) {
        try {
          const parsed = match.Score_1.split(',').map((s: string) => {
            const [p1, p2] = s.split('-').map((str) => parseInt(str.trim()) || 0);
            return { p1, p2 };
          });
          setScores(parsed.length > 0 ? parsed : [{ p1: 0, p2: 0 }]);
          setActiveSet(parsed.length > 0 ? parsed.length - 1 : 0);
        } catch (e) {
          setScores([{ p1: 0, p2: 0 }]);
          setActiveSet(0);
        }
      } else {
        setScores([{ p1: 0, p2: 0 }]);
        setActiveSet(0);
      }
    }
  }, [selectedMatchId, data, selectedFormat]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (!isAdminEmail(result.user.email)) {
        await signOut(auth);
        alert('Access denied. Your account is not authorized.');
      }
    } catch (error: any) {
      alert('Google Login Failed: ' + error.message);
    }
  };

  const updateScore = (player: 'p1' | 'p2', delta: number) => {
    const newScores = [...scores];
    newScores[activeSet] = {
      ...newScores[activeSet],
      [player]: Math.max(0, newScores[activeSet][player] + delta),
    };
    setScores(newScores);
  };

  const addNewSet = () => {
    if (scores.length < 5) {
      setScores([...scores, { p1: 0, p2: 0 }]);
      setActiveSet(scores.length);
    }
  };

  const pushUpdate = async () => {
    if (!data || !selectedMatchId) return;
    const updatedMatches = [...data.matches[selectedFormat]];
    const idx = updatedMatches.findIndex((m) => m.Match_ID === selectedMatchId);

    if (idx > -1) {
      if (status === 'completed' && !winner) {
        alert('Please select a winner before saving a completed match!');
        return;
      }

      const scoreString = scores
        .map((s) => `${s.p1}-${s.p2}`)
        .filter((s) => s !== '0-0' || scores.length === 1)
        .join(', ');

      updatedMatches[idx].Score_1 = scoreString;
      updatedMatches[idx].Status = status;

      if (status === 'completed') {
        updatedMatches[idx].Winner = winner;
      } else {
        updatedMatches[idx].Winner = '';
      }

      await updateDoc(doc(db, 'live_data', 'tournament'), {
        [`matches.${selectedFormat}`]: updatedMatches,
        lastUpdated: new Date().toISOString(),
      });

      // ✨ AUTO-ADVANCE WINNER TO NEXT ROUND
      if (status === 'completed' && winner) {
        try {
          await advanceWinners(selectedFormat, selectedMatchId);
          alert('✅ Score updated! Winner advanced to next round.');
        } catch (error) {
          console.error('Advancement error:', error);
          alert('✅ Score updated! (Note: Could not auto-advance winner)');
        }
      } else {
        alert('Live Score Pushed!');
      }

      if (status === 'completed') {
        setWinner('');
        setSelectedMatchId('');
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center space-y-6">
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-blue-900" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Admin Area</h2>
            <p className="text-slate-500 text-sm">Secure login required to edit matches.</p>
          </div>
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google Logo"
              className="w-6 h-6"
            />
            Sign in with Google
          </button>
          <p className="text-slate-400 text-xs mt-2">
            Only authorized accounts can access this area.
          </p>
        </div>
      </div>
    );
  }

  if (!data)
    return <div className="text-center mt-20 font-bold animate-pulse">Loading Database...</div>;

  const currentMatch = data?.matches[selectedFormat]?.find(
    (m: any) => m.Match_ID === selectedMatchId
  );
  const p1Name = currentMatch?.Player_1 || currentMatch?.Players_1 || 'Player 1';
  const p2Name = currentMatch?.Player_2 || currentMatch?.Players_2 || 'Player 2';

  return (
    <div className="min-h-screen bg-slate-100 p-2 pb-20 md:p-4">
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden mt-4">
        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
          <h1 className="text-xl font-black flex items-center gap-2 tracking-wide">
            <Activity className="text-red-500 animate-pulse" /> UMPIRE MODE
          </h1>
          <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-400">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {data.formats.map((f: string) => (
                <button
                  key={f}
                  onClick={() => {
                    setSelectedFormat(f);
                    setSelectedMatchId('');
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm ${selectedFormat === f ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <select
              className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700"
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
            >
              <option value="">-- Choose a match to umpire --</option>
              {data.matches[selectedFormat].map((m: any) => (
                <option key={m.Match_ID} value={m.Match_ID}>
                  {m.Match_ID}: {m.Player_1 || m.Players_1} vs {m.Player_2 || m.Players_2}
                </option>
              ))}
            </select>
          </div>

          {selectedMatchId && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {scores.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSet(idx)}
                    className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${activeSet === idx ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500'}`}
                  >
                    Set {idx + 1}
                  </button>
                ))}
                {scores.length < 5 && (
                  <button
                    onClick={addNewSet}
                    className="p-2 rounded-full bg-slate-100 text-emerald-600 hover:bg-emerald-50 ml-auto"
                  >
                    <PlusCircle size={20} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-center font-bold text-slate-600 h-10 line-clamp-2 leading-tight">
                    {p1Name}
                  </div>
                  <button
                    onClick={() => updateScore('p1', 1)}
                    className="w-full aspect-square bg-emerald-50 border-2 border-emerald-500 rounded-2xl flex flex-col items-center justify-center text-emerald-700 active:bg-emerald-500 active:text-white transition-colors shadow-sm"
                  >
                    <Plus size={32} className="opacity-50 mb-2" />
                    <span className="text-6xl font-black">{scores[activeSet].p1}</span>
                  </button>
                  <button
                    onClick={() => updateScore('p1', -1)}
                    className="w-full py-3 bg-slate-100 rounded-xl text-slate-500 font-bold flex justify-center active:bg-slate-300"
                  >
                    <Minus size={20} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-center font-bold text-slate-600 h-10 line-clamp-2 leading-tight">
                    {p2Name}
                  </div>
                  <button
                    onClick={() => updateScore('p2', 1)}
                    className="w-full aspect-square bg-emerald-50 border-2 border-emerald-500 rounded-2xl flex flex-col items-center justify-center text-emerald-700 active:bg-emerald-500 active:text-white transition-colors shadow-sm"
                  >
                    <Plus size={32} className="opacity-50 mb-2" />
                    <span className="text-6xl font-black">{scores[activeSet].p2}</span>
                  </button>
                  <button
                    onClick={() => updateScore('p2', -1)}
                    className="w-full py-3 bg-slate-100 rounded-xl text-slate-500 font-bold flex justify-center active:bg-slate-300"
                  >
                    <Minus size={20} />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 space-y-4">
                <select
                  className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="in-progress">🟢 Match is LIVE</option>
                  <option value="completed">🏁 Match Completed</option>
                  <option value="scheduled">📅 Scheduled (Not Started)</option>
                </select>

                {status === 'completed' && (
                  <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl animate-in fade-in duration-300">
                    <label className="block text-sm font-black text-yellow-800 uppercase mb-2 flex items-center gap-2">
                      <Trophy size={16} /> Select Winner
                    </label>
                    <select
                      className="w-full p-3 border-2 border-yellow-300 rounded-xl bg-white font-bold"
                      value={winner}
                      onChange={(e) => setWinner(e.target.value)}
                    >
                      <option value="">Who won?</option>
                      <option value={p1Name}>{p1Name}</option>
                      <option value={p2Name}>{p2Name}</option>
                    </select>
                  </div>
                )}
              </div>

              <button
                onClick={pushUpdate}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Activity className="animate-pulse" /> PUSH TO LIVE TV
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
