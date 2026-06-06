import { useState, useEffect, useCallback } from "react";
import { Trash2, Plus, Loader2, UserCheck, UserX, Activity, LogOut, Minus, PlusCircle, Trophy, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { advanceWinners } from "@/lib/tournamentProgression";

/* -- Shared Types -------------------------------------------------- */
export type Holiday = { date: string; name: string };
export type Announcement = { title: string; date?: string; startDate?: string; endDate?: string; category: string; priority?: string; location?: string; contact?: string; content: string; };
export type EventItem = { date: string; title: string; link: string; registrationDeadline?: string };
export type VideoItem = { id: string; title: string; videoId: string; category: string };
export type Player = { id: string; full_name: string; email?: string; department?: string; is_approved: boolean; created_at: string; stats?: any; iisc_email?: string; contact_number?: string; sr_number?: string; };

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition";
const labelCls = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";
const cardCls  = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";


/* ================================================================ */
/*  Holiday Editor                                                   */
/* ================================================================ */
export function HolidayEditor({ data, onChange }: { data: Holiday[]; onChange: (d: Holiday[]) => void }) {
  const add    = () => onChange([...data, { date: "", name: "" }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof Holiday, val: string) => {
    const next = [...data]; next[i] = { ...next[i], [field]: val }; onChange(next);
  };
  return (
    <div className="space-y-3">
      {data.map((h, i) => (
        <div key={i} className={`${cardCls} flex flex-col sm:flex-row gap-3 items-start sm:items-end`}>
          <div className="flex-1 min-w-0">
            <label className={labelCls}>Date</label>
            <input type="date" value={h.date} onChange={e => update(i, "date", e.target.value)} className={inputCls} />
          </div>
          <div className="flex-[2] min-w-0">
            <label className={labelCls}>Holiday Name</label>
            <input value={h.name} onChange={e => update(i, "name", e.target.value)} className={inputCls} placeholder="e.g. Republic Day" />
          </div>
          <button onClick={() => remove(i)} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition text-sm font-bold w-full justify-center">
        <Plus className="w-4 h-4" /> Add Holiday
      </button>
    </div>
  );
}

/* ================================================================ */
/*  Announcement Editor                                              */
/* ================================================================ */
export function AnnouncementEditor({ data, onChange }: { data: Announcement[]; onChange: (d: Announcement[]) => void }) {
  const add    = () => onChange([{ title: "", date: new Date().toISOString().slice(0, 10), category: "general", priority: "medium", content: "" }, ...data]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => {
    const next = [...data]; next[i] = { ...next[i], [field]: val }; onChange(next);
  };
  const categories = ["tournament", "facility", "general", "event"];
  return (
    <div className="space-y-4">
      <button onClick={add} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition shadow-md shadow-emerald-500/20">
        <Plus className="w-4 h-4" /> New Announcement
      </button>
      {data.map((a, i) => (
        <div key={i} className={`${cardCls} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">#{i + 1}</span>
            <button onClick={() => remove(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"><Trash2 className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Title</label><input value={a.title} onChange={e => update(i, "title", e.target.value)} className={inputCls} placeholder="Announcement title" /></div>
            <div><label className={labelCls}>Date</label><input type="date" value={a.date || ""} onChange={e => update(i, "date", e.target.value)} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={a.category} onChange={e => update(i, "category", e.target.value)} className={inputCls}>
                {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={a.priority || "medium"} onChange={e => update(i, "priority", e.target.value)} className={inputCls}>
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
            <div><label className={labelCls}>Location</label><input value={a.location || ""} onChange={e => update(i, "location", e.target.value)} className={inputCls} placeholder="Optional" /></div>
            <div><label className={labelCls}>Start Date</label><input type="date" value={a.startDate || ""} onChange={e => update(i, "startDate", e.target.value)} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Content (HTML)</label>
            <textarea rows={3} value={a.content} onChange={e => update(i, "content", e.target.value)} className={`${inputCls} resize-y`} placeholder="Supports HTML: <strong>, <br>, <a> tags..." />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================ */
/*  Event Editor                                                     */
/* ================================================================ */
export function EventEditor({ data, onChange }: { data: EventItem[]; onChange: (d: EventItem[]) => void }) {
  const add    = () => onChange([...data, { date: "", title: "", link: "", registrationDeadline: "" }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => {
    const next = [...data]; next[i] = { ...next[i], [field]: val }; onChange(next);
  };
  return (
    <div className="space-y-3">
      {data.map((e, i) => (
        <div key={i} className={`${cardCls} grid grid-cols-1 sm:grid-cols-2 gap-3`}>
          <div><label className={labelCls}>Title</label><input value={e.title} onChange={ev => update(i, "title", ev.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Date</label><input type="date" value={e.date} onChange={ev => update(i, "date", ev.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Link</label><input value={e.link} onChange={ev => update(i, "link", ev.target.value)} className={inputCls} placeholder="/events/..." /></div>
          <div className="flex items-end gap-2">
            <div className="flex-1"><label className={labelCls}>Reg. Deadline</label><input type="date" value={e.registrationDeadline || ""} onChange={ev => update(i, "registrationDeadline", ev.target.value)} className={inputCls} /></div>
            <button onClick={() => remove(i)} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition mb-0.5"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition text-sm font-bold w-full justify-center">
        <Plus className="w-4 h-4" /> Add Event
      </button>
    </div>
  );
}

/* ================================================================ */
/*  Video Editor                                                     */
/* ================================================================ */
export function VideoEditor({ data, onChange }: { data: VideoItem[]; onChange: (d: VideoItem[]) => void }) {
  const add    = () => onChange([...data, { id: `v${Date.now()}`, title: "", videoId: "", category: "" }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => {
    const next = [...data]; next[i] = { ...next[i], [field]: val }; onChange(next);
  };
  const parseVideoId = (input: string) => {
    const m = input.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11})/);
    return m ? m[1] : input.trim();
  };
  return (
    <div className="space-y-4">
      {data.map((v, i) => (
        <div key={i} className={`${cardCls} flex flex-col lg:flex-row gap-4`}>
          {v.videoId && (
            <div className="w-full lg:w-48 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
              <img src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={labelCls}>Title</label><input value={v.title} onChange={e => update(i, "title", e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>YouTube URL or ID</label><input value={v.videoId} onChange={e => update(i, "videoId", parseVideoId(e.target.value))} className={inputCls} placeholder="Paste YouTube URL or video ID" /></div>
            <div className="flex items-end gap-2">
              <div className="flex-1"><label className={labelCls}>Category</label><input value={v.category} onChange={e => update(i, "category", e.target.value)} className={inputCls} placeholder="e.g. Farewell Matches 2026" /></div>
              <button onClick={() => remove(i)} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition mb-0.5"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition text-sm font-bold w-full justify-center">
        <Plus className="w-4 h-4" /> Add Video
      </button>
    </div>
  );
}

/* ================================================================ */
/*  Players Manager                                                  */
/* ================================================================ */
export function PlayersManager() {
  const [players, setPlayers]     = useState<Player[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState<"all" | "pending" | "approved">("all");
  const [actionId, setActionId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, email, department, is_approved, created_at, stats, iisc_email, contact_number, sr_number")
      .order("created_at", { ascending: false });
    if (!error && data) setPlayers(data as Player[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setActionId(id);
    const { error } = await supabase.from("players").update({ is_approved: true }).eq("id", id);
    if (error) { toast("Approve failed: " + error.message, { icon: "❌" }); }
    else { toast("Player approved!", { icon: "✅" }); setPlayers(p => p.map(pl => pl.id === id ? { ...pl, is_approved: true } : pl)); }
    setActionId(null);
  };

  const revoke = async (id: string) => {
    setActionId(id);
    const { error } = await supabase.from("players").update({ is_approved: false }).eq("id", id);
    if (error) { toast("Revoke failed: " + error.message, { icon: "❌" }); }
    else { toast("Approval revoked.", { icon: "⚠️" }); setPlayers(p => p.map(pl => pl.id === id ? { ...pl, is_approved: false } : pl)); }
    setActionId(null);
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete player "${name}"? This cannot be undone.`)) return;
    setActionId(id);
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) { toast("Delete failed: " + error.message, { icon: "❌" }); }
    else { toast("Player deleted.", { icon: "🗑️" }); setPlayers(p => p.filter(pl => pl.id !== id)); }
    setActionId(null);
  };

  const filtered = players.filter(p => {
    const matchesSearch = !search ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.department?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "approved" ? p.is_approved : !p.is_approved);
    return matchesSearch && matchesFilter;
  });

  const pending = players.filter(p => !p.is_approved).length;

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: players.length, color: "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
          { label: "Approved", value: players.filter(p => p.is_approved).length, color: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
          { label: "Pending", value: pending, color: `${pending > 0 ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"}` },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.color}`}>
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs font-bold uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, department..."
            className={`${inputCls} pl-10`} />
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "approved"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${filter === f ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button onClick={load} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm font-medium">No players found.</div>
        )}
        {filtered.map(p => {
          const elo = p.stats?.elo ?? p.stats?.eloRating ?? null;
          const busy = actionId === p.id;
          return (
            <div key={p.id} className={`${cardCls} flex flex-col sm:flex-row gap-3 items-start sm:items-center`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white">{p.full_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.is_approved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"}`}>
                    {p.is_approved ? "Approved" : "Pending"}
                  </span>
                  {elo && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 font-bold">ELO {elo}</span>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 space-x-2">
                  {p.email && <span>{p.email}</span>}
                  {p.department && <span>· {p.department}</span>}
                  {p.sr_number && <span>· SR# {p.sr_number}</span>}
                  {p.contact_number && <span>· {p.contact_number}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {!p.is_approved ? (
                  <button onClick={() => approve(p.id)} disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                ) : (
                  <button onClick={() => revoke(p.id)} disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-600 dark:text-slate-300 hover:text-amber-700 text-xs font-bold transition disabled:opacity-50">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                    Revoke
                  </button>
                )}
                <button onClick={() => remove(p.id, p.full_name)} disabled={busy}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================ */
/*  Umpire Mode (Firebase-based live scoring)                        */
/* ================================================================ */
export function UmpireMode() {
  const [fbUser, setFbUser]         = useState<FirebaseUser | null>(null);
  const [data, setData]             = useState<any>(null);
  const [selectedFormat, setFormat] = useState("MS");
  const [selectedMatchId, setMatchId] = useState("");
  const [status, setStatus]         = useState("in-progress");
  const [winner, setWinner]         = useState("");
  const [scores, setScores]         = useState<{ p1: number; p2: number }[]>([{ p1: 0, p2: 0 }]);
  const [activeSet, setActiveSet]   = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        setFbUser(user);
      } else {
        try { await signInAnonymously(auth); } catch (err) { console.warn("Firebase anon sign-in failed:", err); }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    const unsub = onSnapshot(doc(db, "live_data", "tournament"), snap => {
      if (snap.exists()) setData(snap.data());
    });
    return () => unsub();
  }, [fbUser]);

  useEffect(() => {
    if (!data || !selectedMatchId) { setScores([{ p1: 0, p2: 0 }]); setActiveSet(0); return; }
    const match = data.matches[selectedFormat]?.find((m: any) => m.Match_ID === selectedMatchId);
    if (match?.Score_1) {
      try {
        const parsed = match.Score_1.split(",").map((s: string) => {
          const [p1, p2] = s.split("-").map((x: string) => parseInt(x.trim()) || 0);
          return { p1, p2 };
        });
        setScores(parsed.length > 0 ? parsed : [{ p1: 0, p2: 0 }]);
        setActiveSet(parsed.length - 1);
      } catch { setScores([{ p1: 0, p2: 0 }]); setActiveSet(0); }
    } else {
      setScores([{ p1: 0, p2: 0 }]); setActiveSet(0);
    }
    setStatus(match?.Status || "in-progress");
    setWinner(match?.Winner || "");
  }, [selectedMatchId, data, selectedFormat]);

  const updateScore = (player: "p1" | "p2", delta: number) => {
    const next = [...scores];
    next[activeSet] = { ...next[activeSet], [player]: Math.max(0, next[activeSet][player] + delta) };
    setScores(next);
  };

  const pushUpdate = async () => {
    if (!data || !selectedMatchId) return;
    const updatedMatches = [...data.matches[selectedFormat]];
    const idx = updatedMatches.findIndex((m: any) => m.Match_ID === selectedMatchId);
    if (idx === -1) return;
    if (status === "completed" && !winner) { toast("Select a winner before saving!", { icon: "⚠️" }); return; }
    const scoreStr = scores.map(s => `${s.p1}-${s.p2}`).filter((s, i) => s !== "0-0" || scores.length === 1).join(", ");
    updatedMatches[idx] = { ...updatedMatches[idx], Score_1: scoreStr, Status: status, Winner: status === "completed" ? winner : "" };
    await updateDoc(doc(db, "live_data", "tournament"), { [`matches.${selectedFormat}`]: updatedMatches, lastUpdated: new Date().toISOString() });
    if (status === "completed" && winner) {
      try { await advanceWinners(selectedFormat, selectedMatchId); toast("Score saved & winner advanced!", { icon: "✅" }); }
      catch { toast("Score saved (auto-advance failed)", { icon: "⚠️" }); }
      setWinner(""); setMatchId("");
    } else {
      toast("Live score pushed!", { icon: "📡" });
    }
  };

  if (!fbUser) return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-bold animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin" /> Connecting to live data...
      </div>
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-bold animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading live data...
      </div>
    </div>
  );

  const currentMatch = data.matches[selectedFormat]?.find((m: any) => m.Match_ID === selectedMatchId);
  const p1Name = currentMatch?.Player_1 || currentMatch?.Players_1 || "Player 1";
  const p2Name = currentMatch?.Player_2 || currentMatch?.Players_2 || "Player 2";

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
          <Activity className="w-4 h-4 animate-pulse" /> Live as {fbUser.email}
        </div>
        <button onClick={() => signOut(auth)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition border border-slate-200 dark:border-slate-700">
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      {/* Format selector */}
      <div className="flex flex-wrap gap-2">
        {data.formats.map((f: string) => (
          <button key={f} onClick={() => { setFormat(f); setMatchId(""); }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${selectedFormat === f ? "bg-emerald-600 text-white shadow-md" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Match selector */}
      <select value={selectedMatchId} onChange={e => setMatchId(e.target.value)} className={inputCls}>
        <option value="">— Choose a match to umpire —</option>
        {data.matches[selectedFormat].map((m: any) => (
          <option key={m.Match_ID} value={m.Match_ID}>
            {m.Match_ID}: {m.Player_1 || m.Players_1} vs {m.Player_2 || m.Players_2}
          </option>
        ))}
      </select>

      {selectedMatchId && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Set tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {scores.map((_, idx) => (
              <button key={idx} onClick={() => setActiveSet(idx)}
                className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${activeSet === idx ? "bg-blue-600 text-white shadow-md scale-105" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                Set {idx + 1}
              </button>
            ))}
            {scores.length < 5 && (
              <button onClick={() => { setScores([...scores, { p1: 0, p2: 0 }]); setActiveSet(scores.length); }}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 ml-auto">
                <PlusCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Scoreboard */}
          <div className="grid grid-cols-2 gap-4">
            {([["p1", p1Name], ["p2", p2Name]] as const).map(([player, name]) => (
              <div key={player} className="space-y-2">
                <div className="text-center font-bold text-slate-700 dark:text-slate-200 h-10 line-clamp-2 leading-tight text-sm">{name}</div>
                <button onClick={() => updateScore(player, 1)}
                  className="w-full aspect-square bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-500 rounded-2xl flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-400 active:bg-emerald-500 active:text-white transition shadow-sm">
                  <Plus className="w-8 h-8 opacity-50 mb-1" />
                  <span className="text-6xl font-black">{scores[activeSet][player]}</span>
                </button>
                <button onClick={() => updateScore(player, -1)}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 font-bold flex justify-center active:bg-slate-300 dark:active:bg-slate-700">
                  <Minus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          {/* Status + winner */}
          <div className="space-y-3">
            <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
              <option value="in-progress">🟢 Match is LIVE</option>
              <option value="completed">🏁 Match Completed</option>
              <option value="scheduled">📅 Scheduled (Not Started)</option>
            </select>
            {status === "completed" && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl animate-in fade-in duration-300">
                <label className="flex items-center gap-2 text-xs font-black text-amber-800 dark:text-amber-400 uppercase mb-2">
                  <Trophy className="w-4 h-4" /> Select Winner
                </label>
                <select value={winner} onChange={e => setWinner(e.target.value)} className={inputCls}>
                  <option value="">Who won?</option>
                  <option value={p1Name}>{p1Name}</option>
                  <option value={p2Name}>{p2Name}</option>
                </select>
              </div>
            )}
          </div>

          <button onClick={pushUpdate}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
            <Activity className="animate-pulse" /> PUSH TO LIVE
          </button>
        </div>
      )}
    </div>
  );
}


