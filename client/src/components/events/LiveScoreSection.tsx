import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Activity, Tv2, Trash2, Save, ShieldCheck, X, MonitorPlay, Bell, Loader2, Plus, Volume2, VolumeX, Smartphone, Zap } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { playSmashSound } from "@/lib/sounds";
import type { BwfMatchState } from "@/types/umpire";

function MatchBroadcastCard({
  match,
  isAdmin,
  isUmpire,
  session,
  voiceEnabled,
  flashEnabled,
  vibrateEnabled,
  onKill,
  onSubmit,
  onTakeover,
}: {
  match: BwfMatchState;
  isAdmin: boolean;
  isUmpire: boolean;
  session: any;
  voiceEnabled: boolean;
  flashEnabled: boolean;
  vibrateEnabled: boolean;
  onKill: (matchId: string) => void;
  onSubmit: (m: BwfMatchState, winner: 1 | 2, setsText: string) => void;
  onTakeover: (matchId: string) => void;
}) {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminWinner, setAdminWinner] = useState<1 | 2 | null>(null);
  const [adminSets, setAdminSets] = useState("");
  const [sendingPush, setSendingPush] = useState(false);
  const [flashT1, setFlashT1] = useState(false);
  const [flashT2, setFlashT2] = useState(false);
  const prevScores = useRef({ t1: match.t1.score, t2: match.t2.score });

  useEffect(() => {
    if (match.status !== "playing") return;
    let scoredTeam = 0;
    if (match.t1.score > prevScores.current.t1) {
      if (flashEnabled) {
        setFlashT1(true);
        setTimeout(() => setFlashT1(false), 1000);
      }
      scoredTeam = 1;
    } else if (match.t2.score > prevScores.current.t2) {
      if (flashEnabled) {
        setFlashT2(true);
        setTimeout(() => setFlashT2(false), 1000);
      }
      scoredTeam = 2;
    }

    if (scoredTeam > 0) {
      if (vibrateEnabled && navigator.vibrate) navigator.vibrate(200);

      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(scoredTeam === 1 ? 880 : 1046, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } catch (e) {}

      if (voiceEnabled && window.speechSynthesis) {
        const t1Name = match.t1.p1Name + (match.t1.p2Name ? " and " + match.t1.p2Name : "");
        const t2Name = match.t2.p1Name + (match.t2.p2Name ? " and " + match.t2.p2Name : "");
        const sName = match.serverTeam === 1 ? t1Name : t2Name;
        const rName = match.serverTeam === 1 ? t2Name : t1Name;
        const sScore = match.serverTeam === 1 ? match.t1.score : match.t2.score;
        const rScore = match.serverTeam === 1 ? match.t2.score : match.t1.score;
        
        const text = `${sName}, ${sScore}, ${rScore}, ${rName}`;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        const voices = window.speechSynthesis.getVoices();
        const indianVoice = voices.find(v => 
          (v.lang === 'en-IN' && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('aditi'))) || 
          v.lang === 'en-IN' || v.lang === 'hi-IN'
        );
        if (indianVoice) utterance.voice = indianVoice;
        utterance.rate = 0.65;
        window.speechSynthesis.speak(utterance);
      }
    }
    prevScores.current = { t1: match.t1.score, t2: match.t2.score };
  }, [match.t1.score, match.t2.score, match.status, match.serverTeam, voiceEnabled, flashEnabled, vibrateEnabled]);

  const sendScorePush = async () => {
    setSendingPush(true);
    try {
      const t1Label = match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "");
      const t2Label = match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "");
      const scoreStr = `${match.t1.score} – ${match.t2.score}`;
      const setsStr = match.setsHistory.length ? ` (${match.setsHistory.join(", ")})` : "";
      const round = match.matchNumber || (match.isFriendly ? "Friendly" : "");
      const format = match.inferredCategory || match.category || "";

      const tournamentLine = match.isFriendly ? "🏸 Live Friendly" : `🏆 Live Tournament${format ? ` • ${format}` : ""}`;
      const roundLine = round ? `${round}` : "";
      const title = `${tournamentLine}${roundLine ? ` • ${roundLine}` : ""}`;
      const body = `${t1Label} vs ${t2Label} | ${scoreStr}${setsStr}`;

      const { error: fnError } = await supabase.functions.invoke("send-announcement", {
        body: {
          title,
          body,
          admin_email: session?.user?.email ?? "umpire",
          data: { type: "live_score" },
        },
      });
      if (fnError) throw fnError;

      await supabase.from("site_data").upsert(
        { key: "admin_push", value: { title, body, url: "/feed/live", timestamp: Date.now() }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

      toast.success("Score notification sent to all players!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send push");
    } finally {
      setSendingPush(false);
    }
  };

  if (match.status === "setup") return null;

  const t1Label = match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "");
  const t2Label = match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 sm:p-10 text-foreground max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-sky-500" />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-sm mb-1">
            <Activity className="w-5 h-5 animate-pulse" /> Live Broadcast
          </div>
          <div className="text-muted-foreground text-xs font-bold">
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
          <div className={`p-6 rounded-3xl border-2 transition-all ${match.serverTeam === 1 ? "bg-primary/80/20 border-primary/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "bg-slate-800/50 border-slate-700/50"}`}>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                {match.serverTeam === 1 && match.serverPlayerIndex === 0 && <span className="text-xs font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">S</span>}
                {match.serverTeam === 2 && match.receiverPlayerIndex === 0 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">R</span>}
                {match.t1.p1Name}
              </h3>
              {match.t1.p2Name && (
                <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                  {match.serverTeam === 1 && match.serverPlayerIndex === 1 && <span className="text-xs font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">S</span>}
                  {match.serverTeam === 2 && match.receiverPlayerIndex === 1 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">R</span>}
                  {match.t1.p2Name}
                </h3>
              )}
              {!match.t1.p2Name && match.serverTeam === 2 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded mt-1 inline-block">R · Receiving</span>}
            </div>
            
            <div className="flex justify-center mb-6">
              <div className={`text-[8rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md transition-all duration-300 ${flashT1 ? 'text-primary scale-110 drop-shadow-[0_0_20px_rgba(52,211,153,0.8)]' : ''}`}>
                {match.t1.score}
              </div>
            </div>
            
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full ${i < match.t1.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`} />
              ))}
            </div>
          </div>

          <div className="text-4xl font-black italic text-muted-foreground text-center py-4">VS</div>

          <div className={`p-6 rounded-3xl border-2 transition-all ${match.serverTeam === 2 ? "bg-primary/80/20 border-primary/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "bg-slate-800/50 border-slate-700/50"}`}>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                {match.serverTeam === 2 && match.serverPlayerIndex === 0 && <span className="text-xs font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">S</span>}
                {match.serverTeam === 1 && match.receiverPlayerIndex === 0 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">R</span>}
                {match.t2.p1Name}
              </h3>
              {match.t2.p2Name && (
                <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                  {match.serverTeam === 2 && match.serverPlayerIndex === 1 && <span className="text-xs font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">S</span>}
                  {match.serverTeam === 1 && match.receiverPlayerIndex === 1 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">R</span>}
                  {match.t2.p2Name}
                </h3>
              )}
              {!match.t2.p2Name && match.serverTeam === 1 && <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded mt-1 inline-block">R · Receiving</span>}
            </div>
            
            <div className="flex justify-center mb-6">
              <div className={`text-[8rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md transition-all duration-300 ${flashT2 ? 'text-primary scale-110 drop-shadow-[0_0_20px_rgba(52,211,153,0.8)]' : ''}`}>
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

      {/* ── Admin/Umpire controls ── */}
      {(isAdmin || isUmpire) && match.status !== "finished" && (
        <div className="mt-8 pt-5 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> {isAdmin ? "Admin" : "Umpire"} Controls
          </div>

          {!showAdminForm ? (
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
              <button
                onClick={() => onTakeover(match.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 font-bold text-xs rounded-xl transition"
              >
                <MonitorPlay className="w-4 h-4" /> Open in Umpire
              </button>
              )}
              {isAdmin && (<>
              <button
                onClick={() => { setAdminSets(match.setsHistory.join(", ")); setShowAdminForm(true); }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary/70 font-bold text-xs rounded-xl transition"
              >
                <Save className="w-4 h-4" /> Enter Final Score
              </button>
              <button
                onClick={() => { if (window.confirm("Kill this broadcast? It will be removed without saving a result.")) onKill(match.id); }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" /> Kill Broadcast
              </button>
              </>)}
              <button
                onClick={sendScorePush}
                disabled={sendingPush}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl transition disabled:opacity-50"
              >
                {sendingPush ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                Push Score to All
              </button>
            </div>
          ) : (
            <div className="space-y-3 bg-slate-800/50 rounded-2xl p-4">
              <div>
                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Winner</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setAdminWinner(1)} className={`py-2.5 rounded-xl font-bold text-sm border transition truncate ${adminWinner === 1 ? "bg-primary/20 border-primary text-primary/70" : "bg-slate-900 border-slate-700 text-muted-foreground"}`}>{t1Label}</button>
                  <button onClick={() => setAdminWinner(2)} className={`py-2.5 rounded-xl font-bold text-sm border transition truncate ${adminWinner === 2 ? "bg-sky-500/20 border-sky-500 text-sky-300" : "bg-slate-900 border-slate-700 text-muted-foreground"}`}>{t2Label}</button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Set Scores (e.g. 21-15, 21-18)</label>
                <input value={adminSets} onChange={(e) => setAdminSets(e.target.value)} placeholder="21-15, 21-18" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary transition" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowAdminForm(false); setAdminWinner(null); }} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-1.5">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={() => {
                    if (!adminWinner) { toast.error("Pick a winner"); return; }
                    if (!adminSets.trim()) { toast.error("Enter set scores"); return; }
                    onSubmit(match, adminWinner, adminSets);
                  }}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary text-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
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
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const prevScoresRef = useRef<Record<string, { t1: number; t2: number }>>({});

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
    if (data?.value) {
      // Seed baseline scores so the first load doesn't trigger sounds
      const matches: Record<string, BwfMatchState> = data.value;
      Object.values(matches).forEach((m) => {
        prevScoresRef.current[m.id] = { t1: m.t1.score, t2: m.t2.score };
      });
      setLiveMatches(data.value);
    }
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
            const newMatches: Record<string, BwfMatchState> = (payload.new as any).value;
            // Play smash sound whenever any match score changes
            Object.values(newMatches).forEach((m) => {
              const prev = prevScoresRef.current[m.id];
              if (prev && m.status === "playing" && (m.t1.score !== prev.t1 || m.t2.score !== prev.t2)) {
                playSmashSound();
              }
              prevScoresRef.current[m.id] = { t1: m.t1.score, t2: m.t2.score };
            });
            setLiveMatches(newMatches);
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
          <h2 className="text-xl font-black text-foreground flex items-center justify-center sm:justify-start gap-2">
            <Tv2 className="w-6 h-6 text-primary" /> Live Broadcasts
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Watch live matches happening right now.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 sm:mt-0">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex justify-center items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
              voiceEnabled ? 'bg-primary/20 text-primary border-primary/50 hover:bg-primary/30' : 'bg-slate-800 text-muted-foreground border-slate-700 hover:bg-slate-700'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">Voice</span>
          </button>
          <button
            onClick={() => setFlashEnabled(!flashEnabled)}
            className={`flex justify-center items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
              flashEnabled ? 'bg-primary/20 text-primary border-primary/50 hover:bg-primary/30' : 'bg-slate-800 text-muted-foreground border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Flash</span>
          </button>
          <button
            onClick={() => setVibrateEnabled(!vibrateEnabled)}
            className={`flex justify-center items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
              vibrateEnabled ? 'bg-primary/20 text-primary border-primary/50 hover:bg-primary/30' : 'bg-slate-800 text-muted-foreground border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">Vibrate</span>
          </button>
        </div>
      </div>

      {activeMatchList.filter(m => m.status !== "setup").length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-slate-800 border-dashed">
          <Activity className="w-16 h-16 mx-auto mb-4 opacity-20 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-slate-300">No Live Matches</h2>
          <p className="mt-2 text-muted-foreground">Wait for someone to start broadcasting...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeMatchList.map((m) => (
            <MatchBroadcastCard key={m.id} match={m} isAdmin={isAdmin} isUmpire={isUmpire} session={session} voiceEnabled={voiceEnabled} flashEnabled={flashEnabled} vibrateEnabled={vibrateEnabled} onKill={handleKill} onSubmit={handleSubmit} onTakeover={handleTakeover} />
          ))}
        </div>
      )}
    </div>
  );
}
