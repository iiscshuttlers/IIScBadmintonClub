import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function BroadcastOverlay() {
  const params = useParams<{ matchId: string }>();
  const matchId = params?.matchId;
  
  // Fetch initial match state
  const { data: match, isLoading } = useQuery({
    queryKey: ["broadcast_match", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          team1_player1:profiles!team1_player1_id(name),
          team1_player2:profiles!team1_player2_id(name),
          team2_player1:profiles!team2_player1_id(name),
          team2_player2:profiles!team2_player2_id(name)
        `)
        .eq("id", matchId)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!matchId
  });

  // State to hold realtime updates
  const [liveMatch, setLiveMatch] = useState<any>(null);

  useEffect(() => {
    if (match) {
      setLiveMatch(match);
    }
  }, [match]);

  useEffect(() => {
    if (!matchId) return;

    // Subscribe to realtime updates for this match
    const channel = supabase
      .channel(`broadcast_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`
        },
        (payload) => {
          setLiveMatch((prev: any) => ({
            ...prev,
            ...payload.new
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  if (isLoading || !liveMatch) {
    return (
      <div className="w-screen h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin opacity-50" />
      </div>
    );
  }

  const team1Name = liveMatch.team1_player2 
    ? `${liveMatch.team1_player1?.name} / ${liveMatch.team1_player2?.name}`
    : liveMatch.team1_player1?.name;
    
  const team2Name = liveMatch.team2_player2 
    ? `${liveMatch.team2_player1?.name} / ${liveMatch.team2_player2?.name}`
    : liveMatch.team2_player1?.name;

  return (
    // The background must be completely transparent for OBS chroma-key / overlay
    <div className="w-screen h-screen bg-transparent overflow-hidden relative font-sans">
      
      {/* Broadcast Score Bug - ESPN/BWF Style */}
      <div className="absolute top-12 left-12 flex items-stretch shadow-2xl rounded-xl overflow-hidden animate-in slide-in-from-left-8 duration-700">
        
        {/* Tournament / Event Bug */}
        <div className="bg-slate-900 text-white flex flex-col items-center justify-center px-6 py-2 border-r border-slate-700">
          <div className="text-xl font-black tracking-tighter text-blue-500">IISC</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Badminton</div>
        </div>

        {/* Players & Scores */}
        <div className="flex flex-col bg-slate-800/90 backdrop-blur min-w-[300px]">
          
          {/* Team 1 Row */}
          <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-700/50 ${liveMatch.server === 1 ? 'bg-slate-700/50' : ''}`}>
            <div className="flex items-center gap-2">
              {liveMatch.server === 1 && <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
              <span className="text-white font-bold text-lg truncate max-w-[200px]">{team1Name}</span>
            </div>
            <div className="flex gap-4 items-center">
              {/* Games won dots */}
              <div className="flex gap-1">
                <div className={`w-2 h-2 rounded-full ${liveMatch.team1_games > 0 ? 'bg-blue-500' : 'bg-slate-700'}`} />
                <div className={`w-2 h-2 rounded-full ${liveMatch.team1_games > 1 ? 'bg-blue-500' : 'bg-slate-700'}`} />
              </div>
              <span className="text-yellow-400 font-black text-3xl min-w-[2ch] text-right">{liveMatch.team1_score}</span>
            </div>
          </div>

          {/* Team 2 Row */}
          <div className={`flex items-center justify-between px-4 py-3 ${liveMatch.server === 2 ? 'bg-slate-700/50' : ''}`}>
            <div className="flex items-center gap-2">
              {liveMatch.server === 2 && <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
              <span className="text-white font-bold text-lg truncate max-w-[200px]">{team2Name}</span>
            </div>
            <div className="flex gap-4 items-center">
               {/* Games won dots */}
               <div className="flex gap-1">
                <div className={`w-2 h-2 rounded-full ${liveMatch.team2_games > 0 ? 'bg-blue-500' : 'bg-slate-700'}`} />
                <div className={`w-2 h-2 rounded-full ${liveMatch.team2_games > 1 ? 'bg-blue-500' : 'bg-slate-700'}`} />
              </div>
              <span className="text-yellow-400 font-black text-3xl min-w-[2ch] text-right">{liveMatch.team2_score}</span>
            </div>
          </div>

        </div>

        {/* Match Status */}
        <div className="bg-blue-600 text-white flex flex-col items-center justify-center px-4 font-bold text-sm uppercase tracking-widest min-w-[100px]">
          {liveMatch.status === 'completed' ? 'Final' : `Game ${liveMatch.team1_games + liveMatch.team2_games + 1}`}
        </div>
      </div>
    </div>
  );
}
