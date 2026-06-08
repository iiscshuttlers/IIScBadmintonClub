import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Trophy, Activity, Plus, Minus, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function LiveScore() {
  usePageMeta({ title: "Live Match", description: "Watch live badminton matches." });
  const { profile, isAdmin } = useAuth();
  
  const [liveData, setLiveData] = useState<any>({
    player1: "Player 1", player2: "Player 2",
    score1: 0, score2: 0,
    games1: 0, games2: 0,
    server: 1, active: false
  });

  useEffect(() => {
    // Initial fetch
    supabase.from("site_data").select("value").eq("key", "live_score").single()
      .then(({ data }) => { if (data?.value) setLiveData(data.value); });
    
    // Subscribe to changes
    const sub = supabase.channel('live_score_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_data', filter: "key=eq.live_score" }, 
        (payload) => {
          if (payload.new && (payload.new as any).value) {
            setLiveData((payload.new as any).value);
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const updateScore = async (newScore: any) => {
    setLiveData(newScore);
    const { error } = await supabase.from("site_data").upsert({ key: "live_score", value: newScore });
    if (error) toast.error("Failed to sync live score.");
  };

  const handlePoint = (player: 1 | 2, change: 1 | -1) => {
    if (!isAdmin) return;
    const ns = { ...liveData, server: player };
    if (player === 1) ns.score1 = Math.max(0, ns.score1 + change);
    else ns.score2 = Math.max(0, ns.score2 + change);
    updateScore(ns);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-sky-500" />
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest text-sm">
            <Activity className="w-5 h-5 animate-pulse" /> Live Broadcasting
          </div>
          {isAdmin && (
            <button onClick={() => updateScore({ ...liveData, active: !liveData.active })} className={`px-4 py-1.5 rounded-full text-xs font-bold ${liveData.active ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              {liveData.active ? 'End Match' : 'Start Match'}
            </button>
          )}
        </div>

        {!liveData.active && !isAdmin ? (
          <div className="text-center py-20 text-slate-400">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <h2 className="text-2xl font-bold">No Live Match Currently</h2>
            <p className="mt-2">Waiting for umpire to start broadcasting...</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            {/* Player 1 */}
            <div className="text-center flex-1">
              <input 
                disabled={!isAdmin} 
                value={liveData.player1}
                onChange={e => updateScore({...liveData, player1: e.target.value})}
                className="bg-transparent text-center text-xl font-bold mb-4 w-full outline-none focus:border-b border-slate-700" 
              />
              <div className={`text-8xl font-black tabular-nums transition-colors ${liveData.server === 1 ? 'text-emerald-400' : 'text-white'}`}>
                {liveData.score1}
              </div>
              <div className="mt-2 text-slate-400 font-bold">Games: {liveData.games1}</div>
              
              {isAdmin && (
                <div className="flex justify-center gap-2 mt-6">
                  <button onClick={() => handlePoint(1, -1)} className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 active:scale-95"><Minus/></button>
                  <button onClick={() => handlePoint(1, 1)} className="w-16 h-16 rounded-full bg-emerald-500 text-slate-900 flex items-center justify-center hover:bg-emerald-400 active:scale-95"><Plus className="w-8 h-8"/></button>
                </div>
              )}
            </div>

            <div className="text-3xl font-black text-slate-700">VS</div>

            {/* Player 2 */}
            <div className="text-center flex-1">
              <input 
                disabled={!isAdmin} 
                value={liveData.player2}
                onChange={e => updateScore({...liveData, player2: e.target.value})}
                className="bg-transparent text-center text-xl font-bold mb-4 w-full outline-none focus:border-b border-slate-700" 
              />
              <div className={`text-8xl font-black tabular-nums transition-colors ${liveData.server === 2 ? 'text-emerald-400' : 'text-white'}`}>
                {liveData.score2}
              </div>
              <div className="mt-2 text-slate-400 font-bold">Games: {liveData.games2}</div>

              {isAdmin && (
                <div className="flex justify-center gap-2 mt-6">
                  <button onClick={() => handlePoint(2, -1)} className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 active:scale-95"><Minus/></button>
                  <button onClick={() => handlePoint(2, 1)} className="w-16 h-16 rounded-full bg-emerald-500 text-slate-900 flex items-center justify-center hover:bg-emerald-400 active:scale-95"><Plus className="w-8 h-8"/></button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
