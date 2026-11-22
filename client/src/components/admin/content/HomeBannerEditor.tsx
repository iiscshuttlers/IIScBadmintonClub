import { ArrowDown, ArrowUp, ClipboardList, Copy, Eye, EyeOff, Info, Megaphone, PartyPopper, Pin, PinOff, Trash2 } from "lucide-react";
import type { HomeBanner, HomeBannerColor, HomeBannerType } from "@/lib/homeBanners";
import { cardCls, inputCls, labelCls } from "../editors/shared";
import { itemStatus } from "./contentModel";
import { StatusChip } from "./ContentSection";

const COLORS: HomeBannerColor[] = ["blue", "green", "amber", "red", "purple"];
const COLOR_SWATCH: Record<HomeBannerColor, string> = {
  blue: "bg-info",
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-danger",
  purple: "bg-individual",
};
const TYPES: { id: HomeBannerType; label: string; icon: typeof Megaphone }[] = [
  { id: "announcement", label: "Announcement", icon: Megaphone },
  { id: "notice", label: "Notice", icon: Info },
  { id: "registration", label: "Registration", icon: ClipboardList },
  { id: "custom", label: "Custom", icon: PartyPopper },
];

export function newHomeBanner(): HomeBanner {
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
    starts_on: "",
    ends_on: "",
  };
}

const chipBtn = (on: boolean, onCls: string) =>
  `flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black border transition ${
    on ? onCls : "bg-muted text-muted-foreground border-border-strong"
  }`;

/** Banners at the top of Home. Order matters: Home shows the first one (pinned first). */
export function HomeBannerEditor({
  data,
  onChange,
  today,
}: {
  data: HomeBanner[];
  onChange: (d: HomeBanner[]) => void;
  today: string;
}) {
  const update = (i: number, patch: Partial<HomeBanner>) =>
    onChange(data.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onChange(data.filter((_, j) => j !== i));
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= data.length) return;
    const next = [...data];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const duplicate = (i: number) => {
    const copy = { ...data[i], id: crypto.randomUUID(), title: `${data[i].title} (copy)`, active: false };
    onChange([...data.slice(0, i + 1), copy, ...data.slice(i + 1)]);
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <Megaphone className="w-9 h-9 text-muted-foreground mx-auto mb-2" aria-hidden />
        <p className="font-bold text-muted-foreground">No Home banners yet</p>
        <p className="text-sm text-muted-foreground mt-1">Use “Add banner” to put a notice at the top of Home.</p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {data.map((banner, i) => {
        const status = itemStatus(banner.active, banner.starts_on, banner.ends_on, today);
        return (
          <li key={banner.id} className={`${cardCls} space-y-3 ${status === "live" ? "" : "opacity-80"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-muted-foreground">#{i + 1}</span>
              <StatusChip status={status} />
              <button
                type="button"
                onClick={() => update(i, { active: !banner.active })}
                className={chipBtn(banner.active, "bg-success/15 text-success border-success/30")}
              >
                {banner.active ? <Eye className="w-3.5 h-3.5" aria-hidden /> : <EyeOff className="w-3.5 h-3.5" aria-hidden />}
                {banner.active ? "Visible" : "Hidden"}
              </button>
              <button
                type="button"
                onClick={() => update(i, { pinned: !banner.pinned })}
                title="Pinned banners go first and can't be dismissed"
                className={chipBtn(!!banner.pinned, "bg-warning/15 text-warning border-warning/30")}
              >
                {banner.pinned ? <Pin className="w-3.5 h-3.5" aria-hidden /> : <PinOff className="w-3.5 h-3.5" aria-hidden />}
                {banner.pinned ? "Pinned" : "Dismissible"}
              </button>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30">
                  <ArrowUp className="w-4 h-4" aria-hidden />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === data.length - 1} aria-label="Move down" className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30">
                  <ArrowDown className="w-4 h-4" aria-hidden />
                </button>
                <button type="button" onClick={() => duplicate(i)} aria-label="Duplicate" className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
                  <Copy className="w-4 h-4" aria-hidden />
                </button>
                <button type="button" onClick={() => remove(i)} aria-label="Delete banner" className="p-1.5 rounded-lg text-danger hover:bg-danger/10">
                  <Trash2 className="w-4 h-4" aria-hidden />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className={labelCls}>Type</span>
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update(i, { type: id })}
                      aria-pressed={banner.type === id}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition ${
                        banner.type === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted-strong"
                      }`}
                    >
                      <Icon className="w-3 h-3" aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className={labelCls}>Colour</span>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => update(i, { color: c })}
                      aria-label={c}
                      aria-pressed={banner.color === c}
                      className={`w-6 h-6 rounded-full ${COLOR_SWATCH[c]} transition-all ${
                        banner.color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-card scale-110" : "opacity-60 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor={`hb-title-${banner.id}`}>Title *</label>
              <input
                id={`hb-title-${banner.id}`}
                value={banner.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Banner headline"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`hb-msg-${banner.id}`}>Message</label>
              <textarea
                id={`hb-msg-${banner.id}`}
                value={banner.message}
                onChange={(e) => update(i, { message: e.target.value })}
                placeholder="A line or two of detail"
                rows={2}
                className={`${inputCls} resize-y`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor={`hb-url-${banner.id}`}>Button link</label>
                <input
                  id={`hb-url-${banner.id}`}
                  value={banner.link_url || ""}
                  onChange={(e) => update(i, { link_url: e.target.value })}
                  placeholder="https://… or /tournaments"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`hb-label-${banner.id}`}>Button label</label>
                <input
                  id={`hb-label-${banner.id}`}
                  value={banner.link_label || ""}
                  onChange={(e) => update(i, { link_label: e.target.value })}
                  placeholder="Register now"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`hb-from-${banner.id}`}>Show from</label>
                <input
                  id={`hb-from-${banner.id}`}
                  type="date"
                  value={banner.starts_on || ""}
                  onChange={(e) => update(i, { starts_on: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`hb-until-${banner.id}`}>Show until</label>
                <input
                  id={`hb-until-${banner.id}`}
                  type="date"
                  value={banner.ends_on || ""}
                  min={banner.starts_on || undefined}
                  onChange={(e) => update(i, { ends_on: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <details>
              <summary className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground">
                Show again to people who dismissed it
              </summary>
              <div className="mt-2">
                <label className={labelCls} htmlFor={`hb-key-${banner.id}`}>Dismiss key</label>
                <input
                  id={`hb-key-${banner.id}`}
                  value={banner.dismiss_key || ""}
                  onChange={(e) => update(i, { dismiss_key: e.target.value })}
                  placeholder="e.g. v2"
                  className={`${inputCls} font-mono`}
                />
                <p className="mt-1 text-xs text-muted-foreground">Change this to any new value and the banner reappears for everyone.</p>
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
