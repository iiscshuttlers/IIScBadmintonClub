import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Save, Loader2, Eye, EyeOff, Pin, PinOff, AlertTriangle, Info, Megaphone, ClipboardList, PartyPopper, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface HomeBanner {
  id: string;
  type: "announcement" | "notice" | "registration" | "custom";
  title: string;
  message: string;
  color: "blue" | "green" | "amber" | "red" | "purple";
  link_url?: string;
  link_label?: string;
  active: boolean;
  pinned?: boolean;
  dismiss_key?: string;
}

const COLORS = ["blue", "green", "amber", "red", "purple"] as const;
const TYPES = [
  { id: "announcement", label: "Announcement", icon: Megaphone },
  { id: "notice", label: "Notice", icon: Info },
  { id: "registration", label: "Registration", icon: ClipboardList },
  { id: "custom", label: "Custom", icon: PartyPopper },
] as const;

const COLOR_PREVIEWS: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
};

function newBanner(): HomeBanner {
  return {
    id: crypto.randomUUID(),
    type: "announcement",
    title: "",
    message: "",
    color: "blue",
    link_url: "",
    link_label: "",
    active: true,
    pinned: false,
    dismiss_key: "",
  };
}

export function HomeBannerManager() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("site_data")
      .select("value")
      .eq("key", "home_banners")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const val = data.value as any;
          setBanners(Array.isArray(val) ? val : (val.banners || []));
        }
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_data")
      .upsert({ key: "home_banners", value: banners as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error("Failed to save: " + error.message);
    else toast.success("Home banners saved!");
  };

  const update = (id: string, field: keyof HomeBanner, val: any) => {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, [field]: val } : b));
  };

  const remove = (id: string) => {
    setBanners(prev => prev.filter(b => b.id !== id));
  };

  const add = () => setBanners(prev => [newBanner(), ...prev]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-foreground">Home Page Banners</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose what to display on the home page — announcements, notices, registration links, or custom messages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={add}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold border border-slate-700 transition"
          >
            <Plus className="w-4 h-4" /> Add Banner
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold transition shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {banners.length === 0 && (
        <div className="text-center py-12 bg-slate-900 rounded-2xl border border-slate-800">
          <Megaphone className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="font-bold text-slate-400">No banners yet</p>
          <p className="text-sm text-slate-600 mt-1">Click "Add Banner" to create your first home page notice</p>
        </div>
      )}

      <AnimatePresence>
        {banners.map((banner) => (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className={`bg-slate-900 rounded-2xl border p-5 space-y-4 ${banner.active ? "border-slate-700" : "border-slate-800 opacity-60"}`}
          >
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Active toggle */}
              <button
                onClick={() => update(banner.id, "active", !banner.active)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition ${
                  banner.active ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/30" : "bg-slate-800 text-slate-500 border border-slate-700"
                }`}
              >
                {banner.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {banner.active ? "Visible" : "Hidden"}
              </button>

              {/* Pinned toggle */}
              <button
                onClick={() => update(banner.id, "pinned", !banner.pinned)}
                title="Pinned banners cannot be dismissed by users"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition ${
                  banner.pinned ? "bg-amber-600/20 text-amber-400 border border-amber-600/30" : "bg-slate-800 text-slate-500 border border-slate-700"
                }`}
              >
                {banner.pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                {banner.pinned ? "Pinned" : "Dismissible"}
              </button>

              <div className="ml-auto">
                <button
                  onClick={() => remove(banner.id)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-950/30 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Type & Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => update(banner.id, "type", id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                        banner.type === id
                          ? "bg-primary text-primary-foreground"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Color</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => update(banner.id, "color", c)}
                      className={`w-7 h-7 rounded-full ${COLOR_PREVIEWS[c]} transition-all ${
                        banner.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110" : "opacity-60 hover:opacity-100"
                      }`}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Title & Message */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Title *</label>
                <input
                  value={banner.title}
                  onChange={e => update(banner.id, "title", e.target.value)}
                  placeholder="Banner headline..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Message</label>
                <textarea
                  value={banner.message}
                  onChange={e => update(banner.id, "message", e.target.value)}
                  placeholder="Detailed message or description..."
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>

            {/* CTA Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Button URL (optional)</label>
                <input
                  value={banner.link_url || ""}
                  onChange={e => update(banner.id, "link_url", e.target.value)}
                  placeholder="https://... or /pulse"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Button Label</label>
                <input
                  value={banner.link_label || ""}
                  onChange={e => update(banner.id, "link_label", e.target.value)}
                  placeholder="Register Now, Learn More..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Dismiss key */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                Dismiss Key <span className="text-slate-600 font-normal normal-case">(change this to "reset" dismissals for all users)</span>
              </label>
              <input
                value={banner.dismiss_key || ""}
                onChange={e => update(banner.id, "dismiss_key", e.target.value)}
                placeholder="e.g. tournament-reg-2025 (leave blank to use auto ID)"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {banners.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold transition shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Banners
          </button>
        </div>
      )}
    </div>
  );
}
