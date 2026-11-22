import { inputCls, labelCls } from "../editors/shared";
import { CLUB_STAT_FIELDS, type ClubStats } from "@/lib/clubStats";
import type { ClubPageContent } from "./contentModel";

/** Text on Club → About & Contact. Stored in club_settings.about / .stats. */
export function ClubPageEditor({ data, onChange }: { data: ClubPageContent; onChange: (d: ClubPageContent) => void }) {
  const setAbout = (field: keyof ClubPageContent["about"], value: string) =>
    onChange({ ...data, about: { ...data.about, [field]: value } });
  const setStat = (field: keyof ClubStats, value: string) => onChange({ ...data, stats: { ...data.stats, [field]: value } });

  return (
    <div className="space-y-5">
      <div>
        <label className={labelCls} htmlFor="club-mission">Our mission</label>
        <textarea
          id="club-mission"
          rows={3}
          value={data.about.mission}
          onChange={(e) => setAbout("mission", e.target.value)}
          className={`${inputCls} resize-y`}
          placeholder="Leave empty to use the built-in mission text."
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="club-history">Our history</label>
        <textarea
          id="club-history"
          rows={5}
          value={data.about.history}
          onChange={(e) => setAbout("history", e.target.value)}
          className={`${inputCls} resize-y`}
          placeholder="Optional. Shown under the mission when filled in."
        />
      </div>
      <div>
        <p className={labelCls}>Club at a glance</p>
        <p className="mb-2 text-xs text-muted-foreground">Shown as a row of numbers on the About page. Leave a box empty to hide it.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CLUB_STAT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-bold text-muted-foreground" htmlFor={`club-stat-${f.key}`}>
                {f.label}
              </label>
              <input
                id={`club-stat-${f.key}`}
                value={data.stats[f.key]}
                onChange={(e) => setStat(f.key, e.target.value)}
                className={inputCls}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
