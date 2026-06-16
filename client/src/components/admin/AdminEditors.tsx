import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  Plus,
  Loader2,
  UserCheck,
  UserX,
  Activity,
  Search,
  RefreshCw,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

/* -- Shared Types -------------------------------------------------- */
export type Holiday = { date: string; name: string };
export type Announcement = {
  title: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  category: string;
  priority?: string;
  location?: string;
  contact?: string;
  content: string;
};
export type EventItem = {
  date: string;
  endDate?: string;
  title: string;
  link: string;
  registrationDeadline?: string;
};
export type Chapter = { time: number; title: string };
export type VideoItem = {
  id: string;
  title: string;
  videoId: string;
  category: string;
  tournament?: string;
  chapters?: Chapter[];
  scoreLogs?: any[];
};
export type Player = {
  id: string;
  full_name: string;
  email?: string;
  department?: string;
  is_approved: boolean;
  created_at: string;
  stats?: any;
  iisc_email?: string;
  contact_number?: string;
  sr_number?: string;
};
export type SiteConfig = {
  stats: {
    members: string;
    tournaments: string;
    courts: string;
    trophies: string;
  };
  about: { history: string; mission: string };
};
export type FlyerItem = { text: string; colorClass: string; };
export type DynamicFlyer = {
  id: string;
  enabled: boolean;
  bgColorClass: string;
  items: FlyerItem[];
};

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition";
const labelCls =
  "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";
const cardCls =
  "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";

/* ================================================================ */
/*  File Uploader Helper                                             */
/* ================================================================ */
export function FileUploader({
  onUpload,
}: {
  onUpload: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage
        .from("invicta_notices")
        .upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage
        .from("invicta_notices")
        .getPublicUrl(fileName);
      onUpload(data.publicUrl);
      toast.success("File uploaded successfully");
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="relative inline-block">
      <input
        type="file"
        onChange={handleUpload}
        disabled={uploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        title="Upload File"
      />
      <button
        type="button"
        disabled={uploading}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold transition"
      >
        {uploading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        )}
        {uploading ? "Uploading..." : "Upload File"}
      </button>
    </div>
  );
}

/* ================================================================ */
/*  Config Editor (Landing Pages & Stats)                            */
/* ================================================================ */
export function ConfigEditor({
  data,
  onChange,
}: {
  data: SiteConfig | null;
  onChange: (d: SiteConfig) => void;
}) {
  const d = data || {
    stats: {
      members: "350+",
      tournaments: "20+",
      courts: "3",
      trophies: "10+",
    },
    about: {
      history: "",
      mission:
        "To foster excellence in badminton through competitive play and community engagement at IISc.",
    },
  };

  const updateStats = (field: keyof SiteConfig["stats"], val: string) =>
    onChange({ ...d, stats: { ...d.stats, [field]: val } });
  const updateAbout = (field: keyof SiteConfig["about"], val: string) =>
    onChange({ ...d, about: { ...d.about, [field]: val } });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className={cardCls}>
        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" /> Global Stats (Home &
          About)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Active Members</label>
            <input
              value={d.stats.members}
              onChange={(e) => updateStats("members", e.target.value)}
              className={inputCls}
              placeholder="e.g. 350+"
            />
          </div>
          <div>
            <label className={labelCls}>Tournaments</label>
            <input
              value={d.stats.tournaments}
              onChange={(e) => updateStats("tournaments", e.target.value)}
              className={inputCls}
              placeholder="e.g. 20+"
            />
          </div>
          <div>
            <label className={labelCls}>Indoor Courts</label>
            <input
              value={d.stats.courts}
              onChange={(e) => updateStats("courts", e.target.value)}
              className={inputCls}
              placeholder="e.g. 3"
            />
          </div>
          <div>
            <label className={labelCls}>IISM Trophies</label>
            <input
              value={d.stats.trophies}
              onChange={(e) => updateStats("trophies", e.target.value)}
              className={inputCls}
              placeholder="e.g. 10+"
            />
          </div>
        </div>
      </div>

      {/* About Page */}
      <div className={cardCls}>
        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-blue-500" /> About Page Content
        </h3>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Our Mission</label>
            <textarea
              rows={3}
              value={d.about.mission}
              onChange={(e) => updateAbout("mission", e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </div>
          <div>
            <label className={labelCls}>Our History</label>
            <textarea
              rows={5}
              value={d.about.history}
              onChange={(e) => updateAbout("history", e.target.value)}
              className={`${inputCls} resize-y`}
              placeholder="Write the club's history here. It will appear on the About page."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/*  Holiday Editor                                                   */
/* ================================================================ */
export function HolidayEditor({
  data,
  onChange,
}: {
  data: Holiday[];
  onChange: (d: Holiday[]) => void;
}) {
  const add = () => onChange([...data, { date: "", name: "" }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof Holiday, val: string) => {
    const next = [...data];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {data.map((h, i) => (
        <div
          key={i}
          className={`${cardCls} flex flex-col sm:flex-row gap-3 items-start sm:items-end`}
        >
          <div className="flex-1 min-w-0">
            <label className={labelCls}>Date</label>
            <input
              type="date"
              value={h.date}
              onChange={(e) => update(i, "date", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex-[2] min-w-0">
            <label className={labelCls}>Holiday Name</label>
            <input
              value={h.name}
              onChange={(e) => update(i, "name", e.target.value)}
              className={inputCls}
              placeholder="e.g. Republic Day"
            />
          </div>
          <button
            onClick={() => remove(i)}
            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition text-sm font-bold w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add Holiday
      </button>
    </div>
  );
}

/* ================================================================ */
/*  Flyer Editor                                                     */
/* ================================================================ */
export function FlyerEditor({
  data,
  onChange,
}: {
  data: DynamicFlyer[];
  onChange: (d: DynamicFlyer[]) => void;
}) {
  const add = () => onChange([...data, { id: `flyer_${Date.now()}`, enabled: true, bgColorClass: "bg-gradient-to-r from-violet-600 to-fuchsia-600", items: [{ text: "New Announcement", colorClass: "text-white" }] }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof DynamicFlyer, val: any) => {
    const next = [...data];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  const addItem = (i: number) => {
    const next = [...data];
    next[i].items = [...next[i].items, { text: "", colorClass: "text-white" }];
    onChange(next);
  };
  const removeItem = (i: number, itemIdx: number) => {
    const next = [...data];
    next[i].items = next[i].items.filter((_, idx) => idx !== itemIdx);
    onChange(next);
  };
  const updateItem = (i: number, itemIdx: number, field: keyof FlyerItem, val: string) => {
    const next = [...data];
    next[i].items[itemIdx] = { ...next[i].items[itemIdx], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {data.map((f, i) => (
        <div key={f.id} className={`${cardCls} flex flex-col gap-3`}>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex-1 w-full sm:w-auto">
              <label className={labelCls}>Background Color Class</label>
              <input
                value={f.bgColorClass}
                onChange={(e) => update(i, "bgColorClass", e.target.value)}
                className={inputCls}
                placeholder="e.g. bg-gradient-to-r from-red-600 to-orange-600"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={f.enabled}
                  onChange={(e) => update(i, "enabled", e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                Enabled
              </label>
              <button
                onClick={() => remove(i)}
                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className={labelCls}>Flyer Items</label>
            {f.items.map((item, itemIdx) => (
              <div key={itemIdx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
                <input
                  value={item.text}
                  onChange={(e) => updateItem(i, itemIdx, "text", e.target.value)}
                  className={`${inputCls} flex-[2]`}
                  placeholder="Text to display..."
                />
                <input
                  value={item.colorClass}
                  onChange={(e) => updateItem(i, itemIdx, "colorClass", e.target.value)}
                  className={`${inputCls} flex-1`}
                  placeholder="e.g. text-yellow-300 font-bold"
                />
                <button
                  onClick={() => removeItem(i, itemIdx)}
                  className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addItem(i)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition text-sm font-bold w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add Flyer
      </button>
    </div>
  );
}

/* ================================================================ */
/*  Announcement Editor                                              */
/* ================================================================ */
export function AnnouncementEditor({
  data,
  onChange,
}: {
  data: Announcement[];
  onChange: (d: Announcement[]) => void;
}) {
  const [pushingIdx, setPushingIdx] = useState<number | null>(null);

  const sendPush = async (a: Announcement) => {
    if (!a.title || !a.content) { toast.error("Title and content required before sending push."); return; }
    const idx = data.indexOf(a);
    setPushingIdx(idx);
    try {
      const { error } = await supabase.functions.invoke("send-announcement", {
        body: { title: a.title, body: a.content.slice(0, 120) },
      });
      if (error) throw error;
      toast.success(`Push sent for "${a.title}"!`);
    } catch (err: any) {
      toast.error("Push failed: " + (err.message ?? String(err)));
    } finally {
      setPushingIdx(null);
    }
  };

  const add = () =>
    onChange([
      {
        title: "",
        date: new Date().toISOString().slice(0, 10),
        category: "general",
        priority: "medium",
        content: "",
      },
      ...data,
    ]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => {
    const next = [...data];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const categories = ["tournament", "facility", "general", "event"];
  return (
    <div className="space-y-4">
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition shadow-md shadow-emerald-500/20"
      >
        <Plus className="w-4 h-4" /> New Announcement
      </button>
      {data.map((a, i) => (
        <div key={i} className={`${cardCls} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              #{i + 1}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => sendPush(a)}
                disabled={pushingIdx === i}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50"
              >
                {pushingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Send Push
              </button>
              <button
                onClick={() => remove(i)}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Title</label>
              <input
                value={a.title}
                onChange={(e) => update(i, "title", e.target.value)}
                className={inputCls}
                placeholder="Announcement title"
              />
            </div>
            <div>
              <label className={labelCls}>Publish Date</label>
              <input
                type="date"
                value={a.date || ""}
                onChange={(e) => update(i, "date", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={a.category}
                onChange={(e) => update(i, "category", e.target.value)}
                className={inputCls}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select
                value={a.priority || "medium"}
                onChange={(e) => update(i, "priority", e.target.value)}
                className={inputCls}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input
                value={a.location || ""}
                onChange={(e) => update(i, "location", e.target.value)}
                className={inputCls}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelCls}>Event Start Date</label>
              <input
                type="date"
                value={a.startDate || ""}
                onChange={(e) => update(i, "startDate", e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Event End Date</label>
              <input
                type="date"
                value={a.endDate || ""}
                onChange={(e) => update(i, "endDate", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Content
              </label>
              <FileUploader
                onUpload={(url) =>
                  update(
                    i,
                    "content",
                    a.content + `\n\n[Download Attachment](${url})`,
                  )
                }
              />
            </div>
            <textarea
              rows={4}
              value={a.content}
              onChange={(e) => update(i, "content", e.target.value)}
              className={`${inputCls} resize-y`}
              placeholder="Write normally! New lines are automatic. You can use markdown: **bold**, *italic*, [Link Text](https://link.com)"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================ */
/*  Event Editor                                                     */
/* ================================================================ */
export function EventEditor({
  data,
  onChange,
}: {
  data: EventItem[];
  onChange: (d: EventItem[]) => void;
}) {
  const add = () =>
    onChange([
      ...data,
      { date: "", title: "", link: "", registrationDeadline: "" },
    ]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => {
    const next = [...data];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {data.map((e, i) => (
        <div
          key={i}
          className={`${cardCls} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`}
        >
          <div>
            <label className={labelCls}>Title</label>
            <input
              value={e.title}
              onChange={(ev) => update(i, "title", ev.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input
              type="date"
              value={e.date}
              onChange={(ev) => update(i, "date", ev.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input
              type="date"
              value={e.endDate || ""}
              onChange={(ev) => update(i, "endDate", ev.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Link
              </label>
              <FileUploader onUpload={(url) => update(i, "link", url)} />
            </div>
            <input
              value={e.link}
              onChange={(ev) => update(i, "link", ev.target.value)}
              className={inputCls}
              placeholder="/events/..."
            />
          </div>
          <div className="flex items-end gap-2 lg:col-span-2">
            <div className="flex-1">
              <label className={labelCls}>Reg. Deadline</label>
              <input
                type="date"
                value={e.registrationDeadline || ""}
                onChange={(ev) =>
                  update(i, "registrationDeadline", ev.target.value)
                }
                className={inputCls}
              />
            </div>
            <button
              onClick={() => remove(i)}
              className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition mb-0.5"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition text-sm font-bold w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add Event
      </button>
    </div>
  );
}

/* ================================================================ */
/*  Video Editor                                                     */
/* ================================================================ */
// Parse "M:SS" or plain seconds string → number of seconds
function parseTime(val: string): number {
  const trimmed = val.trim();
  if (trimmed.includes(":")) {
    const [m, s] = trimmed.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }
  return Math.max(0, parseInt(trimmed, 10) || 0);
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function VideoEditor({
  data,
  onChange,
}: {
  data: VideoItem[];
  onChange: (d: VideoItem[]) => void;
}) {
  const add = () =>
    onChange([
      ...data,
      {
        id: `v${Date.now()}`,
        title: "",
        videoId: "",
        category: "",
        tournament: "",
        chapters: [],
      },
    ]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => {
    const next = [...data];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const parseVideoId = (input: string) => {
    const m = input.match(
      /(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11})/,
    );
    return m ? m[1] : input.trim();
  };

  const addChapter = (i: number) => {
    const chapters = [...(data[i].chapters ?? []), { time: 0, title: "" }];
    const next = [...data];
    next[i] = { ...next[i], chapters };
    onChange(next);
  };
  const removeChapter = (i: number, ci: number) => {
    const chapters = (data[i].chapters ?? []).filter((_, idx) => idx !== ci);
    const next = [...data];
    next[i] = { ...next[i], chapters };
    onChange(next);
  };
  const updateChapter = (
    i: number,
    ci: number,
    field: "time" | "title",
    val: string,
  ) => {
    const chapters = [...(data[i].chapters ?? [])];
    chapters[ci] = {
      ...chapters[ci],
      [field]: field === "time" ? parseTime(val) : val,
    };
    chapters.sort((a, b) => a.time - b.time);
    const next = [...data];
    next[i] = { ...next[i], chapters };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Admin Guide */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 text-sm text-emerald-800 dark:text-emerald-300">
        <h4 className="font-black flex items-center gap-2 mb-3 text-emerald-900 dark:text-emerald-400"><Activity className="w-5 h-5" /> Live Scoreboard & Scoring Mode Guide</h4>
        <ul className="list-disc list-inside space-y-2 opacity-90 marker:text-emerald-500">
          <li><strong>Auto-Extracting Names:</strong> Name your video title with exactly this format: <code className="bg-black/10 dark:bg-black/30 px-1.5 py-0.5 rounded font-bold">Player A and Player B vs Player C and Player D || Match Title</code> to automatically populate the BWF player names on the live scoreboard.</li>
          <li><strong>Scoring a Match:</strong> Open any video in the front-end Gallery. Click the "Score Mode" toggle in the top right of the title bar. Click the player buttons as you watch to record timestamps.</li>
          <li><strong>Importing Scores:</strong> When finished, click the red "Copy JSON Data" button in the player. Come back here, find the video, and click the <strong>"Paste from Clipboard"</strong> button below to instantly attach the live scoreboard!</li>
        </ul>
      </div>

      {data.map((v, i) => (
        <div key={i} className={`${cardCls} flex flex-col gap-4`}>
          <div className="flex flex-col lg:flex-row gap-4">
            {v.videoId && (
              <div className="w-full lg:w-48 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                <img
                  src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>Title</label>
                <input
                  value={v.title}
                  onChange={(e) => update(i, "title", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>YouTube URL or ID</label>
                <input
                  value={v.videoId}
                  onChange={(e) =>
                    update(i, "videoId", parseVideoId(e.target.value))
                  }
                  className={inputCls}
                  placeholder="Paste YouTube URL or video ID"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-end gap-2">
                <div className="flex-1">
                  <label className={labelCls}>Category</label>
                  <input
                    value={v.category}
                    onChange={(e) => update(i, "category", e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Farewell Matches 2026"
                  />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>Tournament Tag</label>
                  <input
                    value={v.tournament || ""}
                    onChange={(e) => update(i, "tournament", e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Spectrum 2026"
                  />
                </div>
                <button
                  onClick={() => remove(i)}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition mb-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Chapter editor */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + " mb-0"}>
                Chapters{" "}
                <span className="text-slate-400 font-normal">
                  (optional — mark key moments)
                </span>
              </label>
              <button
                onClick={() => addChapter(i)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition font-semibold"
              >
                <Plus className="w-3 h-3" /> Add chapter
              </button>
            </div>
            {(v.chapters ?? []).length === 0 && (
              <p className="text-xs text-slate-400 italic">No chapters yet.</p>
            )}
            <div className="space-y-2">
              {(v.chapters ?? []).map((ch, ci) => (
                <div key={ch.time} className="flex items-center gap-2">
                  <input
                    className={inputCls + " w-20 shrink-0 font-mono text-xs"}
                    placeholder="0:00"
                    defaultValue={fmtTime(ch.time)}
                    onBlur={(e) => updateChapter(i, ci, "time", e.target.value)}
                  />
                  <input
                    className={inputCls + " flex-1 text-sm"}
                    placeholder="Chapter title"
                    value={ch.title}
                    onChange={(e) =>
                      updateChapter(i, ci, "title", e.target.value)
                    }
                  />
                  <button
                    onClick={() => removeChapter(i, ci)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Score Logs Importer */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 -mx-5 -mb-5 p-5 rounded-b-2xl">
            <div>
               <label className={labelCls + " mb-0"}>Live Scoreboard Data</label>
               <p className="text-[11px] font-bold text-slate-500 mt-0.5">{(v.scoreLogs ?? []).length} timestamps recorded.</p>
            </div>
            <div className="flex gap-2">
               <button onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) {
                       update(i, "scoreLogs", parsed as any);
                       toast.success("Live score data successfully imported!");
                    } else {
                       toast.error("Clipboard does not contain valid score data array.");
                    }
                  } catch(e) { toast.error("No valid JSON found in clipboard"); }
               }} className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition shadow-sm">
                 Paste from Clipboard
               </button>
               {v.scoreLogs && v.scoreLogs.length > 0 && (
                 <button onClick={() => update(i, "scoreLogs", undefined as any)} className="text-xs font-bold px-3 py-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 transition">
                   Clear
                 </button>
               )}
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition text-sm font-bold w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add Video
      </button>
    </div>
  );
}

/* ================================================================ */
/*  Players Manager                                                  */
/* ================================================================ */
type AuthUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
};

export function PlayersManager() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "profile" | "no-profile" | "pending" | "approved"
  >("profile");
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [playersRes, funcRes] = await Promise.all([
        supabase
          .from("players")
          .select(
            "id, full_name, email, department, is_approved, created_at, stats, iisc_email, contact_number, sr_number",
          )
          .order("created_at", { ascending: false }),
        supabase.functions.invoke("admin-users", { method: "GET" }),
      ]);

      if (!playersRes.error && playersRes.data)
        setPlayers(playersRes.data as Player[]);
      if (!funcRes.error && funcRes.data?.users)
        setAuthUsers(funcRes.data.users as AuthUser[]);
    } catch (err) {
      console.error("Failed to load accounts:", err);
      toast.error(
        "Failed to load full account list. Is the admin-users edge function deployed?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string) => {
    setActionId(id);
    const { data, error } = await supabase
      .from("players")
      .update({ is_approved: true })
      .eq("id", id)
      .select();
    if (error) {
      toast("Approve failed: " + error.message, { icon: "❌" });
    } else if (!data || data.length === 0) {
      toast("Permission Denied", {
        icon: "❌",
        description: "Database RLS policy blocked the update.",
      });
    } else {
      toast("Player approved!", { icon: "✅" });
      setPlayers((p) =>
        p.map((pl) => (pl.id === id ? { ...pl, is_approved: true } : pl)),
      );
    }
    setActionId(null);
  };

  const revoke = async (id: string) => {
    setActionId(id);
    const { data, error } = await supabase
      .from("players")
      .update({ is_approved: false })
      .eq("id", id)
      .select();
    if (error) {
      toast("Revoke failed: " + error.message, { icon: "❌" });
    } else if (!data || data.length === 0) {
      toast("Permission Denied", {
        icon: "❌",
        description: "Database RLS policy blocked the update.",
      });
    } else {
      toast("Approval revoked.", { icon: "⚠️" });
      setPlayers((p) =>
        p.map((pl) => (pl.id === id ? { ...pl, is_approved: false } : pl)),
      );
    }
    setActionId(null);
  };

  const approveAllPending = async () => {
    const pendingPlayers = players.filter((p) => !p.is_approved);
    if (pendingPlayers.length === 0) return;
    if (!confirm(`Approve all ${pendingPlayers.length} pending players?`)) return;
    
    const ids = pendingPlayers.map(p => p.id);
    const { error } = await supabase.from("players").update({ is_approved: true }).in("id", ids);
    if (error) {
      toast.error("Bulk approve failed: " + error.message);
    } else {
      toast.success(`Approved ${pendingPlayers.length} players!`);
      setPlayers(p => p.map(pl => ids.includes(pl.id) ? { ...pl, is_approved: true } : pl));
    }
  };

  const exportCsv = () => {
    if (players.length === 0) return;
    const headers = ["ID", "Name", "Email", "Department", "Approved", "Created At", "ELO", "Singles", "Doubles", "Mixed"];
    const rows = players.map(p => {
      const elo = p.stats?.elo ?? p.stats?.eloRating ?? "";
      const s = p.stats?.singles ?? "";
      const d = p.stats?.doubles ?? "";
      const xd = p.stats?.mixed ?? "";
      return [
        p.id,
        `"${p.full_name || ""}"`,
        `"${p.email || ""}"`,
        `"${p.department || ""}"`,
        p.is_approved,
        p.created_at,
        elo, s, d, xd
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `players_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeProfile = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete profile for "${name}"? This deletes their player card but NOT their login account.`,
      )
    )
      return;
    setActionId(id);
    const { data, error } = await supabase
      .from("players")
      .delete()
      .eq("id", id)
      .select();
    if (error) {
      toast("Delete failed: " + error.message, { icon: "❌" });
    } else if (!data || data.length === 0) {
      toast("Permission Denied", {
        icon: "❌",
        description: "Database RLS policy blocked the deletion.",
      });
    } else {
      toast("Profile deleted.", { icon: "🗑️" });
      setPlayers((p) => p.filter((pl) => pl.id !== id));
    }
    setActionId(null);
  };

  const removeAccount = async (id: string, email: string) => {
    if (
      !confirm(
        `Permanently delete account "${email}"? This will wipe their login and their profile if it exists. Cannot be undone!`,
      )
    )
      return;
    setActionId(id);
    const { error } = await supabase.functions.invoke("admin-users", {
      method: "DELETE",
      body: { userId: id },
    });
    if (error) {
      toast("Delete failed: " + error.message, { icon: "❌" });
    } else {
      toast("Account permanently deleted.", { icon: "🗑️" });
      setAuthUsers((u) => u.filter((user) => user.id !== id));
      setPlayers((p) => p.filter((pl) => pl.id !== id));
    }
    setActionId(null);
  };

  const noProfileUsers = authUsers.filter(
    (u) => !players.some((p) => p.id === u.id),
  );

  // Determine which list to show based on filter
  let displayList: any[] = [];
  if (filter === "no-profile") {
    displayList = noProfileUsers;
  } else {
    displayList = players;
  }

  const filtered = displayList.filter((item) => {
    const s = search.toLowerCase();
    if (filter === "no-profile") {
      const u = item as AuthUser;
      return !s || u.email?.toLowerCase().includes(s);
    } else {
      const p = item as Player;
      const matchesSearch =
        !s ||
        p.full_name?.toLowerCase().includes(s) ||
        p.email?.toLowerCase().includes(s) ||
        p.department?.toLowerCase().includes(s);
      const matchesFilter =
        filter === "profile" ||
        (filter === "approved" ? p.is_approved : !p.is_approved);
      return matchesSearch && matchesFilter;
    }
  });

  const pending = players.filter((p) => !p.is_approved).length;

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Total Acc",
            value: authUsers.length,
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Profiles",
            value: players.length,
            color: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "No Profile",
            value: noProfileUsers.length,
            color: "bg-amber-50 text-amber-700",
          },
          {
            label: "Pending",
            value: pending,
            color: `${pending > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-500"}`,
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl border p-4 text-center ${s.color}`}
          >
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs font-bold uppercase tracking-wider mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, department..."
            className={`${inputCls} pl-10`}
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button 
             onClick={approveAllPending}
             disabled={pending === 0}
             className="px-3 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-100 disabled:opacity-50 transition mr-2"
          >
             <UserCheck className="w-3.5 h-3.5 inline mr-1" />
             Approve All ({pending})
          </button>
          <button 
             onClick={exportCsv}
             className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 disabled:opacity-50 transition mr-2"
          >
             Download CSV
          </button>
          {(["profile", "no-profile", "pending", "approved"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${filter === f ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300"}`}
              >
                {f === "profile"
                  ? "Profile Created"
                  : f === "no-profile"
                    ? "No Profile (Acc Only)"
                    : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ),
          )}
          <button
            onClick={load}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm font-medium">
            No players found.
          </div>
        )}
        {filtered.map((item) => {
          if (filter === "no-profile") {
            const u = item as AuthUser;
            const busy = actionId === u.id;
            return (
              <div
                key={u.id}
                className={`${cardCls} flex flex-col sm:flex-row gap-3 items-start sm:items-center`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {u.email}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Account Created:{" "}
                    {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => removeAccount(u.id, u.email)}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100 dark:hover:bg-rose-950/20 text-xs font-bold transition disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Delete Account
                  </button>
                </div>
              </div>
            );
          }

          // Normal profile row
          const p = item as Player;
          const elo = p.stats?.elo ?? p.stats?.eloRating ?? null;
          const busy = actionId === p.id;
          return (
            <div
              key={p.id}
              className={`${cardCls} flex flex-col sm:flex-row gap-3 items-start sm:items-center`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {p.full_name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.is_approved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"}`}
                  >
                    {p.is_approved ? "Approved" : "Pending"}
                  </span>
                  {elo && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 font-bold">
                      ELO {elo}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 space-x-2">
                  {p.email && <span>{p.email}</span>}
                  {p.department && <span>· {p.department}</span>}
                  {p.sr_number && <span>· SR# {p.sr_number}</span>}
                  {p.contact_number && <span>· {p.contact_number}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                {!p.is_approved ? (
                  <button
                    onClick={() => approve(p.id)}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    Approve
                  </button>
                ) : (
                  <button
                    onClick={() => revoke(p.id)}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-600 dark:text-slate-300 hover:text-amber-700 text-xs font-bold transition disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserX className="w-3.5 h-3.5" />
                    )}
                    Revoke
                  </button>
                )}
                <button
                  onClick={() => removeProfile(p.id, p.full_name)}
                  disabled={busy}
                  title="Delete Profile Only"
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeAccount(p.id, p.email || p.full_name)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100 dark:hover:bg-rose-950/20 text-xs font-bold transition disabled:opacity-50"
                >
                  Delete Account
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
  const [filter, setFilter] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");
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

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (
    id: string,
    status: "approved" | "rejected" | "pending",
  ) => {
    setActionId(id);
    const { error } = await supabase
      .from("tournament_registrations")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast(`Failed to ${status}: ` + error.message, { icon: "❌" });
    } else {
      toast(`Registration ${status}.`, {
        icon: status === "approved" ? "✅" : "⚠️",
      });
      setRegistrations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r)),
      );
    }
    setActionId(null);
  };

  const filtered = registrations.filter(
    (r) => filter === "all" || r.status === filter,
  );

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Total",
            value: registrations.length,
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Pending",
            value: registrations.filter((r) => r.status === "pending").length,
            color: "bg-amber-50 text-amber-700",
          },
          {
            label: "Approved",
            value: registrations.filter((r) => r.status === "approved").length,
            color: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "Rejected",
            value: registrations.filter((r) => r.status === "rejected").length,
            color: "bg-rose-50 text-rose-700",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl p-4 text-center ${s.color}`}
          >
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs font-bold uppercase tracking-wider mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap ${filter === f ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-2xl">
            No registrations found.
          </div>
        )}
        {filtered.map((r) => {
          const busy = actionId === r.id;
          return (
            <div
              key={r.id}
              className={`${cardCls} flex flex-col md:flex-row gap-4 items-start md:items-center`}
            >
              <div className="flex-1 space-y-1 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {r.full_name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${r.status === "approved" ? "bg-emerald-100 text-emerald-700" : r.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Events:
                  </span>{" "}
                  {r.categories.join(", ")}
                </div>
                {r.partner_names && Object.keys(r.partner_names).length > 0 && (
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Partners:
                    </span>{" "}
                    {Object.entries(r.partner_names)
                      .map(([cat, name]) => `${cat}: ${name}`)
                      .join(" | ")}
                  </div>
                )}
                <div className="text-xs text-slate-500 font-mono mt-1">
                  UPI: {r.transaction_id}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 border-t border-slate-100 dark:border-slate-800 md:border-none pt-3 md:pt-0 mt-2 md:mt-0">
                <a
                  href={
                    supabase.storage
                      .from("invicta_receipts")
                      .getPublicUrl(r.receipt_path).data.publicUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold"
                >
                  View Receipt
                </a>

                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() => updateStatus(r.id, "approved")}
                      disabled={busy}
                      className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, "rejected")}
                      disabled={busy}
                      className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 text-xs font-bold transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
                {r.status === "rejected" && (
                  <button
                    onClick={() => updateStatus(r.id, "pending")}
                    disabled={busy}
                    className="flex-1 md:flex-none px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition disabled:opacity-50"
                  >
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

export function MatchesManager() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch all matches, fallback to 2 queries if relation doesn't match
    const { data, error } = await supabase
      .from("matches")
      .select(
        `
        *,
        player1:players!matches_player1_id_fkey(full_name),
        player2:players!matches_player2_id_fkey(full_name)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("Join failed, fetching flat matches", error);
      const { data: flatMatches } = await supabase
        .from("matches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      const { data: players } = await supabase
        .from("players")
        .select("id, full_name");
      const pMap = Object.fromEntries(
        (players || []).map((p) => [p.id, p.full_name]),
      );
      if (flatMatches) {
        setMatches(
          flatMatches.map((m) => ({
            ...m,
            player1: { full_name: pMap[m.player1_id] || "Unknown" },
            player2: { full_name: pMap[m.player2_id] || "Unknown" },
          })),
        );
      }
    } else if (data) {
      setMatches(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteMatch = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this match?"))
      return;
    setActionId(id);
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) toast.error("Failed to delete: " + error.message);
    else {
      toast.success("Match deleted");
      setMatches((prev) => prev.filter((m) => m.id !== id));
    }
    setActionId(null);
  };

  const recalculateElo = async () => {
    if (!confirm("WARNING: This will wipe all current ELOs and recalculate them from scratch. It might take up to a minute. Proceed?")) return;
    setActionId("recalc");
    const start = Date.now();
    const { error } = await supabase.rpc("recalculate_all_elo");
    if (error) {
      toast.error("Recalculation failed: " + error.message);
      await supabase.from("admin_logs").insert({ admin_email: "admin", action: "elo_recalculate_failed", details: error.message });
    } else {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      toast.success("ELO Recalculation complete!");
      await supabase.from("admin_logs").insert({ admin_email: "admin", action: "elo_recalculate_all", details: `Completed in ${elapsed}s` });
      load();
    }
    setActionId(null);
  };

  const revokeMatch = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to revoke this match? It will be marked as 'rejected'.",
      )
    )
      return;
    setActionId(id);
    const { error } = await supabase
      .from("matches")
      .update({ status: "rejected" })
      .eq("id", id);
    if (error) toast.error("Failed to revoke: " + error.message);
    else {
      toast.success("Match revoked");
      setMatches((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "rejected" } : m)),
      );
    }
    setActionId(null);
  };

  const exportMatchesCsv = () => {
    if (matches.length === 0) return;
    const headers = ["ID", "Status", "Created At", "Player1", "Player2", "Category", "Score", "Winner ID", "P1 Elo Change", "P2 Elo Change"];
    const rows = matches.map(m => [
      m.id,
      m.status,
      m.created_at,
      `"${m.player1?.full_name || m.player1_id || ""}"`,
      `"${m.player2?.full_name || m.player2_id || ""}"`,
      m.category || "friendly",
      `"${m.match_score || m.score || ""}"`,
      m.winner_id,
      m.elo_change_p1 || "",
      m.elo_change_p2 || ""
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matches_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-slate-800 dark:text-white">
          Recent Matches (Last 100)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={recalculateElo}
            disabled={actionId === "recalc"}
            className="flex items-center gap-2 px-3 py-2 border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 font-bold text-xs rounded-xl hover:bg-rose-100 disabled:opacity-50 transition"
          >
            {actionId === "recalc" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recalculate All ELOs
          </button>
          <button
            onClick={exportMatchesCsv}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          <button
            onClick={load}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {matches.map((m, idx) => {
          const busy = actionId === m.id;
          return (
            <div
              key={m.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-slate-400 text-xs mr-2">
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {m.player1?.full_name || m.player1_id}{" "}
                    <span className="text-slate-400 font-normal mx-1">vs</span>{" "}
                    {m.player2?.full_name || m.player2_id}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${m.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : m.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {m.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                  {m.match_score || m.score}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => revokeMatch(m.id)}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg disabled:opacity-50 transition"
                >
                  Revoke
                </button>
                <button
                  onClick={() => deleteMatch(m.id)}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg flex items-center gap-1 disabled:opacity-50 transition"
                >
                  <Trash2 className="w-3 h-3" /> Delete
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
/*  Changelog Viewer                                                 */
/* ================================================================ */
export function ChangelogViewer() {
  const [changelog, setChangelog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/changelog.json?v=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
         if (Array.isArray(data)) setChangelog(data);
         setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (changelog.length === 0) {
    return (
      <div className="p-10 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        No release history available yet. Run the release script to generate the first entry.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 dark:before:via-slate-700 before:to-transparent">
        {changelog.map((release, idx) => (
          <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 dark:border-slate-950 bg-emerald-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
              <Activity className="w-4 h-4" />
            </div>
            
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h4 className="font-black text-lg text-emerald-600 dark:text-emerald-400">Version {release.versionName}</h4>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">Build {release.versionCode}</span>
              </div>
              <time className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                {new Date(release.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
              <ul className="space-y-2">
                {release.changes.map((change: string, i: number) => (
                  <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
                    <span>{change.replace(/^- /, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
