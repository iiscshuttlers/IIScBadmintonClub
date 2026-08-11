// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Activity, Tv2, Trash2, Save, ShieldCheck, X, MonitorPlay, Bell, Loader2, Plus, Volume2, VolumeX, Smartphone, Zap, CalendarDays, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { MatchService } from "@/services/matchService";
import { getCourtColor, cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMatchAlerts } from "@/hooks/useUserMatchAlerts";
import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import FloatingScore from "@/lib/floatingScore";
import { playSmashSound } from "@/lib/sounds";
import type { BwfMatchState } from "@/types/umpire";
import { NotificationModal } from "./NotificationModal";
import { useConfirm } from "@/contexts/ConfirmContext";

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
  onTakeoverRequest,
  isScorePinned,
  togglePinScore
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
  onTakeoverRequest: (match: BwfMatchState) => void;
  isScorePinned: boolean;
  togglePinScore: (matchId: string) => void;
}) {
  const [, setLocation] = useLocation();
  const { confirm } = useConfirm();
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
        
        // CRITICAL FIX: Close the context after the beep to release the hardware slot limit
        setTimeout(() => {
          if (ctx.state !== "closed") {
            ctx.close().catch(console.error);
          }
        }, 300);
      } catch (e) {
        console.error("Audio beep failed", e);
      }

      if (voiceEnabled) {
        const t1Name = match.t1.p1Name + (match.t1.p2Name ? " and " + match.t1.p2Name : "");
        const t2Name = match.t2.p1Name + (match.t2.p2Name ? " and " + match.t2.p2Name : "");
        const sName = match.serverTeam === 1 ? t1Name : t2Name;
        const rName = match.serverTeam === 1 ? t2Name : t1Name;
        const sScore = match.serverTeam === 1 ? match.t1.score : match.t2.score;
        const rScore = match.serverTeam === 1 ? match.t2.score : match.t1.score;
        
        const text = `${sName}, ${sScore}, ${rName}, ${rScore}`;

        if (Capacitor.isNativePlatform()) {
          // Native robust TTS
          TextToSpeech.speak({
            text,
            lang: 'en-IN',
            rate: 0.9,
            pitch: 1.0,
            volume: 1.0,
            category: 'ambient',
          }).catch(console.error);
        } else if (window.speechSynthesis) {
          // Web fallback
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
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-2 font-black uppercase tracking-widest text-sm mb-1 ${match.status === "finished" ? "text-slate-400" : "text-primary"}`}>
            {match.status === "finished" ? (
              <Trophy className="w-5 h-5" />
            ) : (
              <Activity className="w-5 h-5 animate-pulse" />
            )}
            {match.status === "finished" ? "Match Concluded" : "Live Broadcast"}
          </div>
          <div className="text-muted-foreground text-xs font-bold">
            {match.isFriendly ? "Friendly" : `Tournament • ${match.matchNumber}`} • {match.inferredCategory || match.category} • Best of {match.bestOfSets} ({match.pointsToWin} pts) • Umpire: {match.umpireName}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {match.status !== "finished" && (
            <button
              onClick={() => { setLocation(`/tv/${match.id}`); }}
              className="shrink-0 px-3 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white border border-red-500 transition shadow-lg animate-pulse"
              title="Watch Live TV Scoreboard"
            >
              <Tv2 className="w-4 h-4" />
              <span className="font-black">Live TV</span>
            </button>
          )}

          {Capacitor.isNativePlatform() && (
            <button 
               onClick={() => togglePinScore(match.id)} 
               className={`shrink-0 px-3 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 border transition ${isScorePinned ? "bg-violet-600 border-violet-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"}`}>
               <Tv2 className="w-4 h-4" /> <span className="hidden sm:inline">{isScorePinned ? "Unpin Score" : "Pin Score"}</span>
            </button>
          )}
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
      {(isAdmin || isUmpire) && (
        <div className="mt-8 pt-5 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> {isAdmin ? "Admin" : "Umpire"} Controls
          </div>

          {!showAdminForm ? (
            <div className="flex flex-wrap gap-2">
              {/* Umpire/Admin Takeover Button */}
              <button
                onClick={() => onTakeoverRequest(match)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 font-bold text-xs rounded-xl transition"
              >
                <MonitorPlay className="w-4 h-4" /> Open in Umpire
              </button>
              
              {isAdmin && (<>
              <button
                onClick={() => { setAdminSets(match.setsHistory.join(", ")); setShowAdminForm(true); }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary/70 font-bold text-xs rounded-xl transition"
              >
                <Save className="w-4 h-4" /> Enter Final Score
              </button>
              <button
                onClick={() => {
                  if (Capacitor.isNativePlatform()) {
                    // On Capacitor, window.confirm freezes — use direct action with toast undo pattern
                    onKill(match.id);
                    toast.success("Broadcast killed.", { description: "Result not saved." });
                  } else {
                    confirm({ title: "Kill Broadcast", description: "Kill this broadcast? It will be removed without saving a result.", confirmLabel: "Kill Broadcast", confirmVariant: "danger" }).then(ok => {
                      if (ok) onKill(match.id);
                    });
                  }
                }}
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
                  className="flex-1 py-2.5 bg-primary hover:bg-primary text-primary-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
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

import { MatchPredictionCard } from "@/components/feed/MatchPredictions";

export function LiveScoreSection() {
  const { session, profile, isAdmin, isUmpire } = useAuth();
  const matchAlerts = useUserMatchAlerts(session?.user?.id);
  const [, navigate] = useLocation();
  const [liveMatches, setLiveMatches] = useState<Record<string, BwfMatchState>>({});
  const [todayMatches, setTodayMatches] = useState<any[]>([]);
  const [todayMatchesLoading, setTodayMatchesLoading] = useState(true);
  const [picks, setPicks] = useState<Record<string, 1 | 2>>({});
  const [revealedMatchIds, setRevealedMatchIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase
      .from("site_data")
      .select("value")
      .eq("key", "poll_revealed_matches")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setRevealedMatchIds(data.value as Record<string, boolean>);
      });

    const sub = supabase
      .channel("poll_revealed_matches_livescore")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_data", filter: "key=eq.poll_revealed_matches" },
        (payload) => { if ((payload.new as any)?.value) setRevealedMatchIds((payload.new as any).value); })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const toggleRevealMatchPoll = async (matchId: string) => {
    const nextState = { ...revealedMatchIds, [matchId]: !revealedMatchIds[matchId] };
    setRevealedMatchIds(nextState);
    await supabase.from("site_data").upsert({ key: "poll_revealed_matches", value: nextState }, { onConflict: "key" });
  };

  useEffect(() => {
    if (!profile?.id || todayMatches.length === 0) return;
    const ids = todayMatches.map(m => m.id);
    supabase
      .from("live_match_votes")
      .select("live_match_id, pick")
      .eq("user_id", profile.id)
      .in("live_match_id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, 1 | 2> = {};
        for (const row of data) map[row.live_match_id] = row.pick as 1 | 2;
        setPicks(map);
      });
  }, [profile?.id, todayMatches]);

  const handlePick = async (matchId: string, team: 1 | 2) => {
    if (!profile?.id || picks[matchId]) return;
    setPicks(prev => ({ ...prev, [matchId]: team }));
    const { error } = await supabase.from("live_match_votes").insert({
      live_match_id: matchId,
      user_id: profile.id,
      pick: team,
    });
    if (error) {
      setPicks(prev => { const next = { ...prev }; delete next[matchId]; return next; });
    }
  };

  useEffect(() => {
    const loadTodayMatches = async () => {
      try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
        
        const { data } = await supabase
          .from("tournament_matches")
          .select("*, tournaments(name, id), player1:players!player1_id(full_name), player2:players!player2_id(full_name), partner1:players!player3_id(full_name), partner2:players!player4_id(full_name)")
          .not("scheduled_at", "is", null)
          .gte("scheduled_at", startOfDay)
          .lte("scheduled_at", endOfDay)
          .in("status", ["scheduled", "in_progress"]);
          
        if (data) {
          data.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
          setTodayMatches(data);
        }
      } catch (e) {
        console.error("Failed to load today matches", e);
      } finally {
        setTodayMatchesLoading(false);
      }
    };
    loadTodayMatches();
  }, []);

  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem("live_voice") === "true");
  const [flashEnabled, setFlashEnabled] = useState(() => localStorage.getItem("live_flash") !== "false");
  const [vibrateEnabled, setVibrateEnabled] = useState(() => localStorage.getItem("live_vibrate") !== "false");

  useEffect(() => { localStorage.setItem("live_voice", String(voiceEnabled)); }, [voiceEnabled]);
  useEffect(() => { localStorage.setItem("live_flash", String(flashEnabled)); }, [flashEnabled]);
  useEffect(() => { localStorage.setItem("live_vibrate", String(vibrateEnabled)); }, [vibrateEnabled]);
  const [takeoverTarget, setTakeoverTarget] = useState<BwfMatchState | null>(null);
  const [pinnedMatchIds, setPinnedMatchIds] = useState<string[]>([]);
  const prevScoresRef = useRef<Record<string, { t1: number; t2: number }>>({});
  const killedMatchesRef = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [notifMatchTarget, setNotifMatchTarget] = useState<string | null>(null);

  const handleSaveNotif = async (mins: number) => {
    if (!session?.user?.id || !notifMatchTarget) return;
    try {
      const { error } = await supabase.from("user_match_notifications").upsert({
        user_id: session.user.id,
        match_id: notifMatchTarget,
        notify_before_mins: mins
      }, { onConflict: "user_id, match_id" });
      
      if (error) throw error;
    } catch (e: any) {
      toast.error("Failed to set alert: " + e.message);
    }
  };

  // ── Admin: jump into the umpire panel to control a running broadcast ──
  const handleForceTakeover = (matchId: string) => {
    sessionStorage.setItem("umpire_takeover_key", matchId);
    window.dispatchEvent(new CustomEvent("openUmpireTab"));
    setTakeoverTarget(null);
  };
  
  const handleTakeoverRequest = (match: BwfMatchState) => {
    if (session?.user?.id === match.id || session?.user?.id === match.umpireId) {
      // You are already the umpire, just enter
      handleForceTakeover(match.id);
      return;
    }
    setTakeoverTarget(match);
  };

  const sendTakeoverRequest = async (matchId: string) => {
    const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").maybeSingle();
    if (!data?.value) return;
    
    const lm = data.value as Record<string, BwfMatchState>;
    if (!lm[matchId]) return;

    lm[matchId].takeoverRequest = {
      requesterId: session?.user?.id || "",
      requesterName: profile?.full_name || session?.user?.user_metadata?.full_name || "Guest",
      status: "pending"
    };

    await supabase.from("site_data").upsert({ key: "live_matches", value: lm });
    toast.success("Takeover request sent!");
  };

  const fetchLiveMatches = async () => {
    try {
      const { data, error } = await supabase
        .from("site_data")
        .select("value")
        .eq("key", "live_matches")
        .single();
        
      if (error && error.code !== 'PGRST116') {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      
      if (data?.value) {
        // Seed baseline scores so the first load doesn't trigger sounds
      const matches: Record<string, BwfMatchState> = data.value;
      if (killedMatchesRef.current) {
        Array.from(killedMatchesRef.current).forEach(id => delete matches[id]);
      }
      Object.values(matches).forEach((m) => {
        prevScoresRef.current[m.id] = { t1: m.t1.score, t2: m.t2.score };
      });
      setLiveMatches(matches);
    }
    } catch (e) {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  };

  useEffect(() => {
    // Restore killed matches from sessionStorage on mount
    const savedKilled = sessionStorage.getItem("killed_match_ids");
    if (savedKilled) {
      try {
        const killed = JSON.parse(savedKilled);
        killed.forEach((id: string) => killedMatchesRef.current.add(id));
      } catch (e) {
        console.error("Failed to restore killed matches", e);
      }
    }

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
            if (killedMatchesRef.current) {
              Array.from(killedMatchesRef.current).forEach(id => delete newMatches[id]);
            }
            // Play smash sound whenever any match score changes
            Object.values(newMatches).forEach((m) => {
              const prev = prevScoresRef.current[m.id];
              if (prev && m.status === "playing" && (m.t1.score !== prev.t1 || m.t2.score !== prev.t2)) {
                playSmashSound();
              }
              prevScoresRef.current[m.id] = { t1: m.t1.score, t2: m.t2.score };
              
              // Check if our takeover request was approved or rejected
              if (takeoverTarget && takeoverTarget.id === m.id && m.takeoverRequest?.requesterId === session?.user?.id) {
                if (m.takeoverRequest.status === "approved") {
                  toast.success(`${m.umpireName} approved your request!`);
                  handleForceTakeover(m.id);
                } else if (m.takeoverRequest.status === "rejected") {
                  toast.error(`${m.umpireName} rejected your takeover request.`);
                  setTakeoverTarget(null);
                }
              }
            });
            setLiveMatches(newMatches);
          }
        },
      )
      .subscribe();

    // Polling fallback every 5s in case realtime subscription lags
    pollRef.current = setInterval(fetchLiveMatches, 5_000);

    return () => {
      supabase.removeChannel(sub);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const buildFloatingTeamLabel = (team: BwfMatchState["t1"]): string => {
    if (team.teamName) return team.teamName;
    return team.p2Name ? `${team.p1Name} & ${team.p2Name}` : team.p1Name;
  };

  const togglePinScore = async (matchId: string) => {
    if (!Capacitor.isNativePlatform()) {
      toast.error("Floating score is only available on Android");
      return;
    }
    setPinnedMatchIds((prev) => {
      if (prev.includes(matchId)) {
        return prev.filter((id) => id !== matchId);
      } else {
        return [...prev, matchId];
      }
    });
  };

  // Sync floating score whenever pinned matches or their scores change
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    if (pinnedMatchIds.length === 0) {
      FloatingScore.stopService().catch(console.error);
      return;
    }

    const checkAndStart = async () => {
      try {
        const { granted } = await FloatingScore.checkPermission();
        if (!granted) {
          const res = await FloatingScore.requestPermission();
          if (!res.granted) {
            toast.error("Permission required for floating score.");
            setPinnedMatchIds([]); // Reset if denied
            return;
          }
        }

        const matchesPayload = pinnedMatchIds.map(id => {
          const m = liveMatches[id];
          if (!m) return null;
          const scoreStr = `${m.t1.score} - ${m.t2.score}`;
          const teamsStr = `${buildFloatingTeamLabel(m.t1)} vs ${buildFloatingTeamLabel(m.t2)}`;
          return { id, score: scoreStr, teams: teamsStr };
        }).filter(Boolean);

        if (matchesPayload.length > 0) {
          // This will start the service if it isn't running, or update it if it is
          await FloatingScore.startService({ matches: matchesPayload as any });
        }
      } catch (e) {
        console.error("Floating score error", e);
      }
    };

    checkAndStart();
  }, [pinnedMatchIds, liveMatches]);

  // The native overlay's close button / double-tap stops the service, but
  // JS still thinks matches are pinned — without this, the next score poll
  // would just restart the overlay. Clear our state so it stays dismissed.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = FloatingScore.addListener("floatingScoreClosed", () => {
      setPinnedMatchIds([]);
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (Capacitor.isNativePlatform()) {
        FloatingScore.stopService().catch(() => {});
      }
    };
  }, []);

  // ── Admin: remove a broadcast from site_data ──
  const handleKill = async (matchId: string) => {
    const originalMatch = liveMatches[matchId];

    // 1. Optimistic UI update & ignore list
    killedMatchesRef.current.add(matchId);
    let parsedKilled: string[] = [];
    try {
      parsedKilled = JSON.parse(sessionStorage.getItem("killed_match_ids") || "[]");
    } catch (e) {
      parsedKilled = [];
    }
    const killed = new Set<string>(parsedKilled);
    killed.add(matchId);
    sessionStorage.setItem("killed_match_ids", JSON.stringify(Array.from(killed)));

    setLiveMatches(prev => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });

    try {
      // 2. Use MatchService to remove the live match via RPC
      await MatchService.removeLiveMatch(matchId);

      // 3. Verify deletion by checking the database
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for realtime sync
      const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").maybeSingle();
      if (data?.value && data.value[matchId]) {
        throw new Error("Deletion verification failed - match still exists in database");
      }

      console.log("Match deleted successfully:", matchId);
      toast.success("Broadcast removed");
    } catch (err: any) {
      console.error("Kill broadcast error:", err);

      // 4. Revert optimistic update on error
      if (originalMatch) {
        setLiveMatches(prev => ({ ...prev, [matchId]: originalMatch }));
      }
      killedMatchesRef.current.delete(matchId);
      killed.delete(matchId);
      sessionStorage.setItem("killed_match_ids", JSON.stringify(Array.from(killed)));

      toast.error("Failed to remove broadcast: " + (err?.message || "unknown error"));
    }
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
      if (!m.isFriendly && m.id) {
        await supabase.rpc("submit_tournament_match", {
          p_match_id: m.id,
          p_winner_side: winner,
          p_score: sets.join(", "),
          p_sets: sets,
          p_umpire_id: null,
        }).catch(err => console.warn("submit_tournament_match error:", err));
      }
      if (submitId && m.isFriendly) await supabase.rpc("confirm_friendly_match", { match_uuid: submitId, confirmer_id: "umpire_bypass" });
      const notifMsg = `🏆 ${m.isFriendly ? "Friendly" : "Tournament"} Match: ${m.t1.p1Name}${m.t1.p2Name ? ` & ${m.t1.p2Name}` : ""} vs ${m.t2.p1Name}${m.t2.p2Name ? ` & ${m.t2.p2Name}` : ""} — ${sets.join(", ")}`;
      await supabase.from("site_data").upsert({ key: "match_alert", value: { message: notifMsg, time: Date.now() } });

      await handleKill(m.id);
      toast.success("Match submitted & saved to profiles");
    } catch (err: any) {
      toast.error("Failed to submit: " + (err?.message || "unknown error"));
    }
  };

  const activeMatchList = Object.values(liveMatches).filter(match => {
    // Don't show killed matches even if they somehow make it back into liveMatches due to subscription timing
    if (killedMatchesRef.current.has(match.id)) return false;

    if (!match.isFriendly) return true; // Tournaments are public
    if (isAdmin) return true;
    if (session?.user?.id === match.id) return true; // Umpire
    if (!profile) return false;

    const participants = [match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id].filter(Boolean);
    if (participants.includes(profile.id)) return true; // Player

    const buddies = profile.buddies || [];
    const following = profile.following || [];
    return participants.some(pid => buddies.includes(pid) || following.includes(pid));
  }).sort((a, b) => {
    const aPinned = pinnedMatchIds.includes(a.id) ? 1 : 0;
    const bPinned = pinnedMatchIds.includes(b.id) ? 1 : 0;
    return bPinned - aPinned;
  });

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-800 gap-4 text-center sm:text-left">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center justify-center sm:justify-start gap-2">
            <Tv2 className="w-6 h-6 text-primary" /> Live Broadcasts
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Watch live matches happening right now.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 sm:mt-0">
          <button
            onClick={() => {
              if (!voiceEnabled && window.speechSynthesis) {
                // Unlock speech synthesis on mobile webviews with a silent utterance during user gesture
                const u = new SpeechSynthesisUtterance("");
                u.volume = 0;
                window.speechSynthesis.speak(u);
              }
              setVoiceEnabled(!voiceEnabled);
            }}
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
        <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-slate-800 border-dashed">
          <Activity className="w-16 h-16 mx-auto mb-4 opacity-20 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-slate-300">No Live Matches</h2>
          <p className="mt-2 text-muted-foreground">Wait for someone to start broadcasting...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeMatchList.map((m) => (
            <MatchBroadcastCard 
              key={m.id} 
              match={m} 
              isAdmin={isAdmin} 
              isUmpire={isUmpire} 
              session={session} 
              voiceEnabled={voiceEnabled} 
              flashEnabled={flashEnabled} 
              vibrateEnabled={vibrateEnabled} 
              onKill={handleKill} 
              onSubmit={handleSubmit} 
              onTakeover={handleForceTakeover} 
              onTakeoverRequest={handleTakeoverRequest} 
              isScorePinned={pinnedMatchIds.includes(m.id)}
              togglePinScore={togglePinScore}
            />
          ))}
        </div>
      )}

      {/* TODAY'S SCHEDULED MATCHES */}
      <div className="mt-8 bg-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-800">
        <h2 className="text-xl font-black text-foreground flex items-center gap-2 mb-6">
          <CalendarDays className="w-6 h-6 text-blue-400" /> Today's Schedule
        </h2>
        
        {todayMatchesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : todayMatches.length === 0 ? (
          <div className="text-center py-8 bg-slate-800/30 rounded-2xl border border-slate-700/50">
            <p className="text-sm text-muted-foreground">No matches scheduled for today.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {todayMatches.map(m => (
              <div key={m.id} className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3 transition-colors hover:border-slate-500">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-slate-900 px-2 py-0.5 rounded-full shrink-0">{m.category}</span>
                    {(m.match_code || m.match_number) && (
                      <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                        {m.match_code || `Match #${m.match_number}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status === "in_progress" && <span className="text-[10px] font-black text-amber-400 animate-pulse shrink-0">● LIVE</span>}
                    {m.court_number && (
                      <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/50 shadow-inner font-black tracking-widest shrink-0", getCourtColor(m.court_number))}>
                        <MapPin className="w-3.5 h-3.5 opacity-70 shrink-0" /> 
                        <span className="text-xs uppercase whitespace-nowrap">Court {m.court_number}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 my-1">
                  <div className="flex-1 text-center sm:text-left">
                    <p className="font-bold text-[15px] sm:text-sm text-foreground break-words">
                      {[m.player1?.full_name, m.partner1?.full_name].filter(Boolean).join(" & ") || m.team1_label || "TBD"}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <div className="h-[1px] bg-slate-700/50 flex-1 sm:hidden"></div>
                    <span className="text-[10px] font-black text-rose-400 shrink-0">VS</span>
                    <div className="h-[1px] bg-slate-700/50 flex-1 sm:hidden"></div>
                  </div>
                  <div className="flex-1 text-center sm:text-right">
                    <p className="font-bold text-[15px] sm:text-sm text-foreground break-words">
                      {[m.player2?.full_name, m.partner2?.full_name].filter(Boolean).join(" & ") || m.team2_label || "TBD"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-bold bg-slate-900/50 self-start px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" /> 
                    {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {session?.user && (
                    (() => {
                      const alert = matchAlerts.find(a => a.match_id === m.id);
                      if (alert) {
                        const notifyDate = new Date(m.scheduled_at);
                        notifyDate.setMinutes(notifyDate.getMinutes() - alert.notify_before_mins);
                        const timeStr = notifyDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                        return (
                          <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-accent/30 bg-accent/10 text-accent font-medium">
                            <Bell className="w-3.5 h-3.5" fill="currentColor" />
                            <span>Notified at {timeStr}</span>
                            <button 
                              onClick={() => setNotifMatchTarget(m.id)}
                              className="ml-1 font-bold underline hover:text-accent-foreground"
                            >
                              Edit
                            </button>
                          </div>
                        );
                      }
                      return (
                        <button 
                          onClick={() => setNotifMatchTarget(m.id)}
                          className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-300"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          Notify me
                        </button>
                      );
                    })()
                  )}
                </div>

                {m.player1_id && m.player2_id && (
                  <MatchPredictionCard
                    matchId={m.id}
                    t1Ids={[m.player1_id, m.player3_id].filter(Boolean)}
                    t2Ids={[m.player2_id, m.player4_id].filter(Boolean)}
                    t1Label={[m.player1?.full_name, m.partner1?.full_name].filter(Boolean).join(" & ") || m.team1_label || "TBD"}
                    t2Label={[m.player2?.full_name, m.partner2?.full_name].filter(Boolean).join(" & ") || m.team2_label || "TBD"}
                    hasStarted={m.status !== "scheduled" && m.status !== "pending"}
                    myPick={picks[m.id]}
                    profileId={profile?.id}
                    onPick={(team) => handlePick(m.id, team)}
                    isResultsRevealed={!!revealedMatchIds[m.id]}
                    isAdmin={isAdmin}
                    onToggleRevealResults={() => toggleRevealMatchPoll(m.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {takeoverTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center space-y-4">
            <ShieldCheck className="w-12 h-12 text-primary mx-auto opacity-50 mb-2" />
            <h3 className="text-xl font-black text-foreground">Match Handover</h3>
            
            {takeoverTarget.takeoverRequest?.requesterId === session?.user?.id && takeoverTarget.takeoverRequest?.status === "pending" ? (
              <div className="space-y-4 pt-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                <p className="text-sm text-slate-300">
                  Waiting for <span className="font-bold text-amber-400">{takeoverTarget.umpireName}</span> to approve your request...
                </p>
                <button
                  onClick={() => setTakeoverTarget(null)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-foreground font-bold text-sm rounded-xl transition"
                >
                  Cancel Request
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  You are about to take over umpiring from <span className="font-bold text-amber-400">{takeoverTarget.umpireName}</span>.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => sendTakeoverRequest(takeoverTarget.id)}
                    className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition shadow-lg"
                  >
                    Request Takeover
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleForceTakeover(takeoverTarget.id)}
                      className="w-full py-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 font-bold text-sm rounded-xl transition mt-2"
                    >
                      Force Takeover (Admin)
                    </button>
                  )}
                  <button
                    onClick={() => setTakeoverTarget(null)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-foreground font-bold text-sm rounded-xl transition mt-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <NotificationModal 
        isOpen={!!notifMatchTarget}
        onClose={() => setNotifMatchTarget(null)}
        onSave={handleSaveNotif}
        title="Match Reminder"
        defaultMins={15}
        matchTime={notifMatchTarget ? [...Object.values(liveMatches), ...todayMatches].find((m: any) => m.id === notifMatchTarget)?.scheduled_at : null}
      />
    </div>
  );
}
