import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User } from "firebase/auth";
import { Activity, Lock, LogOut } from 'lucide-react';

export default function FarewellAdmin() {
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [selectedFormat, setSelectedFormat] = useState('MS');
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [newScore, setNewScore] = useState('');
  const [status, setStatus] = useState('in-progress');

  // Listen for Authentication state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubAuth();
  }, []);

  // Listen to live data ONLY if logged in
  useEffect(() => {
    if (!user) return;
    const unsubData = onSnapshot(doc(db, "live_data", "tournament"), (docSnap) => {
      if (docSnap.exists()) setData(docSnap.data());
    });
    return () => unsubData();
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      alert("Login Failed: " + error.message);
    }
  };

  const pushUpdate = async () => {
    if (!data || !selectedMatchId) return;
    const updatedMatches = [...data.matches[selectedFormat]];
    const idx = updatedMatches.findIndex(m => m.Match_ID === selectedMatchId);
    
    if (idx > -1) {
      updatedMatches[idx].Score_1 = newScore;
      updatedMatches[idx].Status = status;
      if (status === 'completed') updatedMatches[idx].Winner = "Manual Entry Required";

      await updateDoc(doc(db, "live_data", "tournament"), {
        [`matches.${selectedFormat}`]: updatedMatches,
        lastUpdated: new Date().toISOString()
      });
      alert("Live Score Pushed!");
    }
  };

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-100 p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-blue-900" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Admin Login</h2>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">Email</label>
            <input type="email" required className="w-full p-3 border-2 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">Password</label>
            <input type="password" required className="w-full p-3 border-2 rounded-xl" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          
          <button type="submit" className="w-full bg-blue-900 text-white font-bold py-4 rounded-xl mt-4">
            Sign In
          </button>
        </form>
      </div>
    );
  }

  // --- ADMIN DASHBOARD ---
  if (!data) return <div className="text-center mt-20">Loading Database...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-4 pb-20">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-6 mt-10">
        
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Activity className="text-red-500 animate-pulse" /> Live Control
          </h1>
          <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-500 flex items-center gap-1 text-sm font-bold">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-500 uppercase">1. Select Format</label>
          <div className="flex flex-wrap gap-2">
            {data.formats.map((f: string) => (
              <button 
                key={f} 
                onClick={() => {setSelectedFormat(f); setSelectedMatchId('');}}
                className={`px-4 py-2 rounded-lg font-bold ${selectedFormat === f ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <label className="block text-sm font-bold text-slate-500 uppercase">2. Select Match</label>
          <select 
            className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl"
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
          >
            <option value="">Choose a match...</option>
            {data.matches[selectedFormat].map((m: any) => (
              <option key={m.Match_ID} value={m.Match_ID}>{m.Match_ID}: {m.Player_1 || m.Players_1} vs {m.Player_2 || m.Players_2}</option>
            ))}
          </select>

          <label className="block text-sm font-bold text-slate-500 uppercase">3. Update Score / Status</label>
          <input 
            type="text" 
            placeholder="Score (e.g. 21-14, 15-10)" 
            className="w-full p-3 border-2 rounded-xl mb-2"
            value={newScore}
            onChange={(e) => setNewScore(e.target.value)}
          />
          
          <select 
            className="w-full p-3 border-2 rounded-xl"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="in-progress">LIVE (In Progress)</option>
            <option value="completed">Completed</option>
            <option value="scheduled">Scheduled</option>
          </select>

          <button 
            onClick={pushUpdate}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg mt-4 active:scale-95 transition-transform"
          >
            Update Live Bracket
          </button>
        </div>
      </div>
    </div>
  );
}