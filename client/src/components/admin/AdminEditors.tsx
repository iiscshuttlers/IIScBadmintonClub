import { useState, useEffect, useCallback } from "react";
import { Trash2, Plus, Loader2, UserCheck, UserX, Activity, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

/* -- Shared Types -------------------------------------------------- */
export type Holiday = { date: string; name: string };
export type Announcement = { title: string; date?: string; startDate?: string; endDate?: string; category: string; priority?: string; location?: string; contact?: string; content: string; };
export type EventItem = { date: string; endDate?: string; title: string; link: string; registrationDeadline?: string };
export type VideoItem = { id: string; title: string; videoId: string; category: string };
export type Player = { id: string; full_name: string; email?: string; department?: string; is_approved: boolean; created_at: string; stats?: any; iisc_email?: string; contact_number?: string; sr_number?: string; };
export type SiteConfig = {
  stats: { members: string; tournaments: string; courts: string; trophies: string; };
  about: { history: string; mission: string; };
};

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition";
const labelCls = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";
const cardCls  = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";

/* ================================================================ */
/*  File Uploader Helper                                             */
/* ================================================================ */
export function FileUploader({ onUpload }: { onUpload: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { error } = await supabase.storage.from('invicta_notices').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('invicta_notices').getPublicUrl(fileName);
      onUpload(data.publicUrl);
      toast.success("File uploaded successfully");
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="relative inline-block">
      <input type="file" onChange={handleUpload} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" title="Upload File" />
      <button type="button" disabled={uploading} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold transition">
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
        {uploading ? "Uploading..." : "Upload File"}
      </button>
    </div>
  );
}

/* ================================================================ */
/*  Config Editor (Landing Pages & Stats)                            */
/* ================================================================ */
export function ConfigEditor({ data, onChange }: { data: SiteConfig | null; onChange: (d: SiteConfig) => void }) {
  const d = data || {
    stats: { members: "350+", tournaments: "20+", courts: "3", trophies: "10+" },
    about: { history: "", mission: "To foster excellence in badminton through competitive play and community engagement at IISc." }
  };
  
  const updateStats = (field: keyof SiteConfig["stats"], val: string) => onChange({ ...d, stats: { ...d.stats, [field]: val } });
  const updateAbout = (field: keyof SiteConfig["about"], val: string) => onChange({ ...d, about: { ...d.about, [field]: val } });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className={cardCls}>
        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-500" /> Global Stats (Home & About)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><label className={labelCls}>Active Members</label><input value={d.stats.members} onChange={e => updateStats("members", e.target.value)} className={inputCls} placeholder="e.g. 350+" /></div>
          <div><label className={labelCls}>Tournaments</label><input value={d.stats.tournaments} onChange={e => updateStats("tournaments", e.target.value)} className={inputCls} placeholder="e.g. 20+" /></div>
          <div><label className={labelCls}>Indoor Courts</label><input value={d.stats.courts} onChange={e => updateStats("courts", e.target.value)} className={inputCls} placeholder="e.g. 3" /></div>
          <div><label className={labelCls}>IISM Trophies</label><input value={d.stats.trophies} onChange={e => updateStats("trophies", e.target.value)} className={inputCls} placeholder="e.g. 10+" /></div>
        </div>
      </div>

      {/* About Page */}
      <div className={cardCls}>
        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2"><UserCheck className="w-5 h-5 text-blue-500" /> About Page Content</h3>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Our Mission</label>
            <textarea rows={3} value={d.about.mission} onChange={e => updateAbout("mission", e.target.value)} className={`${inputCls} resize-y`} />
          </div>
          <div>
            <label className={labelCls}>Our History</label>
            <textarea rows={5} value={d.about.history} onChange={e => updateAbout("history", e.target.value)} className={`${inputCls} resize-y`} placeholder="Write the club's history here. It will appear on the About page." />
          </div>
        </div>
      </div>
    </div>
  );
}


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
            <div><label className={labelCls}>Publish Date</label><input type="date" value={a.date || ""} onChange={e => update(i, "date", e.target.value)} className={inputCls} /></div>
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
            <div><label className={labelCls}>Event Start Date</label><input type="date" value={a.startDate || ""} onChange={e => update(i, "startDate", e.target.value)} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Event End Date</label><input type="date" value={a.endDate || ""} onChange={e => update(i, "endDate", e.target.value)} className={inputCls} /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Content</label>
              <FileUploader onUpload={(url) => update(i, "content", a.content + `\n\n[Download Attachment](${url})`)} />
            </div>
            <textarea rows={4} value={a.content} onChange={e => update(i, "content", e.target.value)} className={`${inputCls} resize-y`} placeholder="Write normally! New lines are automatic. You can use markdown: **bold**, *italic*, [Link Text](https://link.com)" />
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
        <div key={i} className={`${cardCls} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`}>
          <div><label className={labelCls}>Title</label><input value={e.title} onChange={ev => update(i, "title", ev.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Start Date</label><input type="date" value={e.date} onChange={ev => update(i, "date", ev.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>End Date</label><input type="date" value={e.endDate || ""} onChange={ev => update(i, "endDate", ev.target.value)} className={inputCls} placeholder="Optional" /></div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Link</label>
              <FileUploader onUpload={(url) => update(i, "link", url)} />
            </div>
            <input value={e.link} onChange={ev => update(i, "link", ev.target.value)} className={inputCls} placeholder="/events/..." />
          </div>
          <div className="flex items-end gap-2 lg:col-span-2">
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
    const { data, error } = await supabase.from("players").update({ is_approved: true }).eq("id", id).select();
    if (error) { toast("Approve failed: " + error.message, { icon: "❌" }); }
    else if (!data || data.length === 0) { toast("Permission Denied", { icon: "❌", description: "Database RLS policy blocked the update." }); }
    else { toast("Player approved!", { icon: "✅" }); setPlayers(p => p.map(pl => pl.id === id ? { ...pl, is_approved: true } : pl)); }
    setActionId(null);
  };

  const revoke = async (id: string) => {
    setActionId(id);
    const { data, error } = await supabase.from("players").update({ is_approved: false }).eq("id", id).select();
    if (error) { toast("Revoke failed: " + error.message, { icon: "❌" }); }
    else if (!data || data.length === 0) { toast("Permission Denied", { icon: "❌", description: "Database RLS policy blocked the update." }); }
    else { toast("Approval revoked.", { icon: "⚠️" }); setPlayers(p => p.map(pl => pl.id === id ? { ...pl, is_approved: false } : pl)); }
    setActionId(null);
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete player "${name}"? This cannot be undone.`)) return;
    setActionId(id);
    const { data, error } = await supabase.from("players").delete().eq("id", id).select();
    if (error) { toast("Delete failed: " + error.message, { icon: "❌" }); }
    else if (!data || data.length === 0) { toast("Permission Denied", { icon: "❌", description: "Database RLS policy blocked the deletion." }); }
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
/*  Umpire Mode — re-exported from dedicated module                  */
/* ================================================================ */
export { UmpireMode } from "./UmpireMode";

/* ================================================================ */
/*  Registrations Manager                                            */
/* ================================================================ */
export function RegistrationsManager() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournament_registrations")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRegistrations(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    setActionId(id);
    const { error } = await supabase.from("tournament_registrations").update({ status }).eq("id", id);
    if (error) { toast(`Failed to ${status}: ` + error.message, { icon: "❌" }); }
    else { 
      toast(`Registration ${status}.`, { icon: status === 'approved' ? "✅" : "⚠️" }); 
      setRegistrations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    }
    setActionId(null);
  };

  const filtered = registrations.filter(r => filter === "all" || r.status === filter);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: registrations.length, color: "bg-blue-50 text-blue-700" },
          { label: "Pending", value: registrations.filter(r => r.status === 'pending').length, color: "bg-amber-50 text-amber-700" },
          { label: "Approved", value: registrations.filter(r => r.status === 'approved').length, color: "bg-emerald-50 text-emerald-700" },
          { label: "Rejected", value: registrations.filter(r => r.status === 'rejected').length, color: "bg-rose-50 text-rose-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 text-center ${s.color}`}>
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs font-bold uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {(["pending", "approved", "rejected", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap ${filter === f ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-2xl">No registrations found.</div>
        )}
        {filtered.map(r => {
          const busy = actionId === r.id;
          return (
            <div key={r.id} className={`${cardCls} flex flex-col md:flex-row gap-4 items-start md:items-center`}>
              <div className="flex-1 space-y-1 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white">{r.full_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : r.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Events:</span> {r.categories.join(', ')}
                </div>
                {r.partner_names && Object.keys(r.partner_names).length > 0 && (
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Partners:</span>{' '}
                    {Object.entries(r.partner_names).map(([cat, name]) => `${cat}: ${name}`).join(' | ')}
                  </div>
                )}
                <div className="text-xs text-slate-500 font-mono mt-1">UPI: {r.transaction_id}</div>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 border-t border-slate-100 dark:border-slate-800 md:border-none pt-3 md:pt-0 mt-2 md:mt-0">
                <a 
                  href={supabase.storage.from('invicta_receipts').getPublicUrl(r.receipt_path).data.publicUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold"
                >
                  View Receipt
                </a>
                
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(r.id, "approved")} disabled={busy}
                      className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50">
                      Approve
                    </button>
                    <button onClick={() => updateStatus(r.id, "rejected")} disabled={busy}
                      className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 text-xs font-bold transition disabled:opacity-50">
                      Reject
                    </button>
                  </>
                )}
                {r.status === 'rejected' && (
                  <button onClick={() => updateStatus(r.id, "pending")} disabled={busy}
                    className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition disabled:opacity-50">
                    Re-evaluate
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
