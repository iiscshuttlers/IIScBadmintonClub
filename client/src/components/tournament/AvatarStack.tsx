import React from "react";

interface AvatarStackProps {
  totalCount: number;
  avatars?: Array<{ name?: string | null; src?: string | null }>;
  maxVisible?: number;
  className?: string;
  size?: "xs" | "sm";
}

function getInitial(name?: string | null): string {
  if (!name) return "P";
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "P";
}

/** Palette for deterministic avatar background gradients */
const GRADIENTS = [
  "from-emerald-400 to-teal-500",
  "from-indigo-400 to-violet-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-cyan-400 to-blue-500",
];

export function AvatarStack({
  totalCount,
  avatars = [],
  maxVisible = 3,
  className = "",
  size = "xs",
}: AvatarStackProps) {
  if (totalCount <= 0) return null;

  const sizeCls = size === "xs" ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs";
  const visibleAvatars = avatars.slice(0, maxVisible);
  const remainder = Math.max(0, totalCount - visibleAvatars.length);

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center -space-x-1.5 overflow-hidden">
        {visibleAvatars.map((av, idx) => {
          const grad = GRADIENTS[idx % GRADIENTS.length];
          return (
            <div
              key={idx}
              className={`relative inline-flex items-center justify-center rounded-full ring-1.5 ring-white dark:ring-slate-900 bg-gradient-to-br ${grad} text-white font-black shadow-xs shrink-0 select-none ${sizeCls}`}
              title={av.name || `Participant ${idx + 1}`}
              aria-label={av.name || `Participant ${idx + 1}`}
            >
              {av.src ? (
                <img
                  src={av.src}
                  alt={av.name || "avatar"}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <span>{getInitial(av.name)}</span>
              )}
            </div>
          );
        })}

        {/* Remainder badge when participants exceed visible avatars */}
        {remainder > 0 && (
          <div
            className={`relative inline-flex items-center justify-center rounded-full ring-1.5 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black shadow-xs shrink-0 select-none ${sizeCls}`}
            title={`+${remainder} more entered`}
            aria-label={`Plus ${remainder} more participants`}
          >
            +{remainder}
          </div>
        )}
      </div>

      <span className="font-semibold text-slate-700 dark:text-slate-300">
        {totalCount} {totalCount === 1 ? "entered" : "entered"}
      </span>
    </div>
  );
}
