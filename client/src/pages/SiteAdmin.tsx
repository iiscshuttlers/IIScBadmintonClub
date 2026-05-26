import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Megaphone, Video, CalendarDays, Plus, Trash2, Save,
  Shield, LogOut, RefreshCw, Check, AlertTriangle, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";

/* ── Types ──────────────────────────────────────────────────────── */
type Holiday = { date: string; name: string };
type Announcement = {
  title: string; date?: string; startDate?: string; endDate?: string;
  category: string; priority?: string; location?: string; contact?: string; content: string;
};
type EventItem = { date: string; title: string; link: string; registrationDeadline?: string };
type VideoItem = { id: string; title: string; videoId: string; category: string };

type TabId = "holidays" | "announcements" | "events" | "videos";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "holidays", label: "Holidays", icon: Calendar },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "videos", label: "Videos", icon: Video },
];

/* ── Helpers ─────────────────────────────────────────────────────── */
async function loadKey<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from("site_data").select("value").eq("key", key).maybeSingle();
  if (error) { console.error(`Load ${key}:`, error); return null; }
  return data?.value as T ?? null;
}

async function saveKey(key: string, value: any) {
  const { error } = await supabase
    .from("site_data").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition";
const labelCls = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";
const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";

/* ================================================================ */
/*  Holiday Editor                                                   */
/* ================================================================ */
function HolidayEditor({ data, onChange }: { data: Holiday[]; onChange: (d: Holiday[]) => void }) {
  const add = () => onChange([...data, { date: "", name: "" }]);
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
          <button onClick={() => remove(i)} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition" title="Remove">
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
function AnnouncementEditor({ data, onChange }: { data: Announcement[]; onChange: (d: Announcement[]) => void }) {
  const add = () => onChange([{ title: "", date: new Date().toISOString().slice(0, 10), category: "general", priority: "medium", content: "" }, ...data]);
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
            <div><label className={labelCls}>Priority</label>
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
function EventEditor({ data, onChange }: { data: EventItem[]; onChange: (d: EventItem[]) => void }) {
  const add = () => onChange([...data, { date: "", title: "", link: "", registrationDeadline: "" }]);
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
function VideoEditor({ data, onChange }: { data: VideoItem[]; onChange: (d: VideoItem[]) => void }) {
  const add = () => onChange([...data, { id: `v${Date.now()}`, title: "", videoId: "", category: "" }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => {
    const next = [...data]; next[i] = { ...next[i], [field]: val }; onChange(next);
  };
  // Extract YouTube video ID from URL or raw ID
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
/*  Main Admin Page                                                  */
/* ================================================================ */
export default function SiteAdmin() {
  usePageMeta({ title: "Site Admin", description: "Manage site content" });
  const [, setLocation] = useLocation();

  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [activeTab, setActiveTab] = useState<TabId>("holidays");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);

  // Auth gate
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setAuthState("denied"); return; }
      const { data } = await supabase.auth.getUser();
      if (data?.user && isAdminEmail(data.user.email)) {
        setAuthState("ok");
      } else {
        setAuthState("denied");
      }
    });
  }, []);

  // Load all data
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [h, a, e, v] = await Promise.all([
        loadKey<Holiday[]>("holidays"),
        loadKey<{ recent: Announcement[] }>("announcements"),
        loadKey<EventItem[]>("events"),
        loadKey<VideoItem[]>("videos"),
      ]);
      if (h) setHolidays(h);
      if (a?.recent) setAnnouncements(a.recent);
      if (e) setEvents(e);
      if (v) setVideos(v);
      setDirty(false);
    } catch (err) {
      console.error("Load error:", err);
      toast("Failed to load data", { icon: "❌" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authState === "ok") loadAll(); }, [authState, loadAll]);

  // Save active tab
  const handleSave = async () => {
    setSaving(true);
    try {
      switch (activeTab) {
        case "holidays":
          await saveKey("holidays", holidays.filter(h => h.date && h.name));
          break;
        case "announcements":
          await saveKey("announcements", { recent: announcements.filter(a => a.title) });
          break;
        case "events":
          await saveKey("events", events.filter(e => e.title && e.date));
          break;
        case "videos":
          await saveKey("videos", videos.filter(v => v.title && v.videoId));
          break;
      }
      setDirty(false);
      toast("Saved successfully!", { icon: "✅", description: `${activeTab} updated — changes are live instantly.` });
    } catch (err: any) {
      toast("Save failed", { icon: "❌", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Wrappers that mark dirty
  const setH = (d: Holiday[]) => { setHolidays(d); setDirty(true); };
  const setA = (d: Announcement[]) => { setAnnouncements(d); setDirty(true); };
  const setE = (d: EventItem[]) => { setEvents(d); setDirty(true); };
  const setV = (d: VideoItem[]) => { setVideos(d); setDirty(true); };

  // Auth screens
  if (authState === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  );

  if (authState === "denied") return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-xl max-w-md">
        <Shield className="w-16 h-16 text-rose-500 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Admin Access Required</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">You need to be signed in with an admin account to access this page.</p>
        <button onClick={() => setLocation("/join")} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-500/20">
          Sign In
        </button>
      </div>
    </div>
  );

  const counts: Record<TabId, number> = {
    holidays: holidays.length,
    announcements: announcements.length,
    events: events.length,
    videos: videos.length,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 text-white py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest mb-2">
                <Shield className="w-4 h-4" /> Admin Panel
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Site Content Manager</h1>
              <p className="text-slate-300 text-sm mt-1">Edit holidays, announcements, events & videos — changes go live instantly.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadAll} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold transition">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Reload
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
                  active
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-emerald-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span className={`text-xs px-2 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>
                  {counts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Editor */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
            {activeTab === "holidays" && <HolidayEditor data={holidays} onChange={setH} />}
            {activeTab === "announcements" && <AnnouncementEditor data={announcements} onChange={setA} />}
            {activeTab === "events" && <EventEditor data={events} onChange={setE} />}
            {activeTab === "videos" && <VideoEditor data={videos} onChange={setV} />}
          </motion.div>
        </AnimatePresence>

        {/* Save bar */}
        <AnimatePresence>
          {dirty && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl border border-slate-700 dark:border-slate-300"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 dark:text-amber-600" />
              <span className="text-sm font-bold">Unsaved changes</span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Save Now"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
