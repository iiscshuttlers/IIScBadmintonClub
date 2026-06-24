import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Activity, Tv2, Trash2, Save, ShieldCheck, X, MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import type { BwfMatchState } from "../umpire/UmpireEngine";

function MatchBroadcastCard({
  match,
  isAdmin,
  onKill,
  onSubmit,
  onTakeover,
}: {
  match: BwfMatchState;
  isAdmin: boolean;
  onKill: (matchId: string) => void;
  onSubmit: (m: BwfMatchState, winner: 1 | 2, setsText: string) => void;
  onTakeover: (matchId: string) => void;
}) {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminWinner, setAdminWinner] = useState<1 | 2 | null>(null);
  const [adminSets, setAdminSets] = useState("");

  if (match.status === "setup") return null;

  const t1Label = match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "");
  const t2Label = match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 sm:p-10 text-white max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500" />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-sm mb-1">
            <Activity className="w-5 h-5 animate-pulse" /> Live Broadcast
          </div>
          <div className="text-slate-400 text-xs font-bold">
            {match.isFriendly ? "Friendly" : `Tournament • ${match.matchNumber}`} • {match.inferredCategory || match.category} • Best of {match.bestOfSets} ({match.pointsToWin} pts) • Umpire: {match.umpireName}
          </div>
        </div>
      </div>

      {match.status === "finished" ? (
        <div className="text-center py-12">
          <Trophy className="w-20 h-20 mx-auto text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
          <h2 className="text-3xl font-black mb-2">Match Finished!</h2>
          <p className="text-xl text-slate-300">
            {match.winner === 1 ? match.t1.p1Name : match.t2.p1Name} Won {match.setsHistory.join(", ")}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
          <div className={`p-6 rounded-3xl border-2 transition-all ${match.serverTeam === 1 ? "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "bg-slate-800/50 border-slate-700/50"}`}>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                {match.serverTeam === 1 && match.serverPlayerIndex === 0 && <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">S</span>}
                {match.serverTeam === 2 && match.receiverPlayerIndex === 0 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">R</span>}
                {match.t1.p1Name}
              </h3>
              {match.t1.p2Name && (
                <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                  {match.serverTeam === 1 && match.serverPlayerIndex === 1 && <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">S</span>}
                  {match.serverTeam === 2 && match.receiverPlayerIndex === 1 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">R</span>}
                  {match.t1.p2Name}
                </h3>
              )}
              {!match.t1.p2Name && match.serverTeam === 2 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded mt-1 inline-block">R · Receiving</span>}
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="text-[8rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md">
                {match.t1.score}
              </div>
            </div>
            
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full ${i < match.t1.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`} />
              ))}
            </div>
          </div>

          <div className="text-4xl font-black italic text-slate-700 text-center py-4">VS</div>

          <div className={`p-6 rounded-3xl border-2 transition-all ${match.serverTeam === 2 ? "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "bg-slate-800/50 border-slate-700/50"}`}>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                {match.serverTeam === 2 && match.serverPlayerIndex === 0 && <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">S</span>}
                {match.serverTeam === 1 && match.receiverPlayerIndex === 0 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">R</span>}
                {match.t2.p1Name}
              </h3>
              {match.t2.p2Name && (
                <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                  {match.serverTeam === 2 && match.serverPlayerIndex === 1 && <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">S</span>}
                  {match.serverTeam === 1 && match.receiverPlayerIndex === 1 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">R</span>}
                  {match.t2.p2Name}
                </h3>
              )}
              {!match.t2.p2Name && match.serverTeam === 1 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded mt-1 inline-block">R · Receiving</span>}
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="text-[8rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md">
                {match.t2.score}
              </div>
            </div>
            
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full ${i < match.t2.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Admin controls ── */}
      {isAdmin && match.status !== "finished" && (
        <div className="mt-8 pt-5 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Admin Controls
          </div>

          {!showAdminForm ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onTakeover(match.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 font-bold text-xs rounded-xl transition"
              >
                <MonitorPlay className="w-4 h-4" /> Open in Umpire
              </button>
              <button
                onClick={() => { setAdminSets(match.setsHistory.join(", ")); setShowAdminForm(true); }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl transition"
              >
                <Save className="w-4 h-4" /> Enter Final Score
              </button>
              <button
                onClick={() => { if (window.confirm("Kill this broadcast? It will be removed without saving a result.")) onKill(match.id); }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" /> Kill Broadcast
              </button>
            </div>
          ) : (
            <div className="space-y-3 bg-slate-800/50 rounded-2xl p-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Winner</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setAdminWinner(1)} className={`py-2.5 rounded-xl font-bold text-sm border transition truncate ${adminWinner === 1 ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "bg-slate-900 border-slate-700 text-slate-400"}`}>{t1Label}</button>
                  <button onClick={() => setAdminWinner(2)} className={`py-2.5 rounded-xl font-bold text-sm border transition truncate ${adminWinner === 2 ? "bg-sky-500/20 border-sky-500 text-sky-300" : "bg-slate-900 border-slate-700 text-slate-400"}`}>{t2Label}</button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Set Scores (e.g. 21-15, 21-18)</label>
                <input value={adminSets} onChange={(e) => setAdminSets(e.target.value)} placeholder="21-15, 21-18" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowAdminForm(false); setAdminWinner(null); }} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={() => {
                    if (!adminWinner) { toast.error("Pick a winner"); return; }
                    if (!adminSets.trim()) { toast.error("Enter set scores"); return; }
                    onSubmit(match, adminWinner, adminSets);
                  }}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Submit & Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LiveScoreSection() {
  const { session, profile, isAdmin, isUmpire } = useAuth();
  const [, navigate] = useLocation();
  const [liveMatches, setLiveMatches] = useState<Record<string, BwfMatchState>>({});

  // ── Admin: jump into the umpire panel to control a running broadcast ──
  const handleTakeover = (matchId: string) => {
    sessionStorage.setItem("umpire_takeover_key", matchId);
    navigate("/feed/umpire");
  };

  const fetchLiveMatches = async () => {
    const { data } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "live_matches")
      .single();
    if (data?.value) setLiveMatches(data.value);
  };

  useEffect(() => {
    fetchLiveMatches();

    // Realtime subscription for immediate updates
    const sub = supabase
      .channel("live_matches_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_data",
          filter: "key=eq.live_matches",
        },
        (payload) => {
          if (payload.new && (payload.new as any).value) {
            setLiveMatches((payload.new as any).value);
          }
        },
      )
      .subscribe();

    // Polling fallback every 5s in case realtime subscription lags
    const poll = setInterval(fetchLiveMatches, 5_000);

    return () => {
      supabase.removeChannel(sub);
      clearInterval(poll);
    };
  }, []);

  // ── Admin: remove a broadcast from site_data ──
  const handleKill = async (matchId: string) => {
    const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").single();
    const lm = (data?.value as Record<string, any>) || {};
    delete lm[matchId];
    await supabase.from("site_data").upsert({ key: "live_matches", value: lm });
    toast.success("Broadcast removed");
  };

  // ── Admin: enter final score → submit confirmed match + remove broadcast ──
  const handleSubmit = async (m: BwfMatchState, winner: 1 | 2, setsText: string) => {
    const sets = setsText.split(",").map(s => s.trim()).filter(Boolean);
    const winnerId = winner === 1 ? m.t1.p1Id : m.t2.p1Id;
    let finalScoreStr = sets.join(", ");
    if (m.category !== "Singles") {
      finalScoreStr += ` [${m.t1.p1Name}+${m.t1.p2Name ?? ""} vs ${m.t2.p1Name}+${m.t2.p2Name ?? ""}]`;
    }
    try {
      const { data: submitId, error } = await supabase.rpc("umpire_submit_match", {
        umpire_id:        m.id,
        player1_id:       m.t1.p1Id,
        player2_id:       m.t2.p1Id,
        team1_partner_id: m.t1.p2Id || "",
        team2_partner_id: m.t2.p2Id || "",
        winner_id:        winnerId,
        match_score:      finalScoreStr,
        match_category:   m.category,
        match_round:      m.matchNumber || (m.isFriendly ? "Friendly" : "Tournament"),
        is_friendly:      m.isFriendly,
      });
      if (error) throw error;
      if (submitId && !m.isFriendly) await supabase.rpc("confirm_friendly_match", { match_uuid: submitId });

      const notifMsg = `🏆 ${m.isFriendly ? "Friendly" : "Tournament"} Match: ${m.t1.p1Name}${m.t1.p2Name ? ` & ${m.t1.p2Name}` : ""} vs ${m.t2.p1Name}${m.t2.p2Name ? ` & ${m.t2.p2Name}` : ""} — ${sets.join(", ")}`;
      await supabase.from("site_data").upsert({ key: "match_alert", value: { message: notifMsg, time: Date.now() } });

      await handleKill(m.id);
      toast.success("Match submitted & saved to profiles");
    } catch (err: any) {
      toast.error("Failed to submit: " + (err?.message || "unknown error"));
    }
  };

  const activeMatchList = Object.values(liveMatches).filter(match => {
    if (!match.isFriendly) return true; // Tournaments are public
    if (isAdmin) return true;
    if (session?.user?.id === match.id) return true; // Umpire
    if (!profile) return false;

    const participants = [match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id].filter(Boolean);
    if (participants.includes(profile.id)) return true; // Player
    
    const buddies = profile.buddies || [];
    const following = profile.following || [];
    return participants.some(pid => buddies.includes(pid) || following.includes(pid));
  });

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-800 gap-4 text-center sm:text-left">
        <div>
          <h2 className="text-xl font-black text-white flex items-center justify-center sm:justify-start gap-2">
            <Tv2 className="w-6 h-6 text-emerald-400" /> Live Broadcasts
          </h2>
          <p className="text-slate-400 text-sm mt-1">Watch live matches happening right now.</p>
        </div>
      </div>

      {activeMatchList.filter(m => m.status !== "setup").length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-slate-800 border-dashed">
          <Activity className="w-16 h-16 mx-auto mb-4 opacity-20 text-slate-400" />
          <h2 className="text-2xl font-bold text-slate-300">No Live Matches</h2>
          <p className="mt-2 text-slate-500">Wait for someone to start broadcasting...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeMatchList.map((m) => (
            <MatchBroadcastCard key={m.id} match={m} isAdmin={isAdmin} onKill={handleKill} onSubmit={handleSubmit} onTakeover={handleTakeover} />
          ))}
        </div>
      )}
    </div>
  );
}
