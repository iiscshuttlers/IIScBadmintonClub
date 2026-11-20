import { useEffect, useState, type RefObject } from "react";
import type { MatchSide, MatchView } from "@/lib/matchView";
import { usePlayerAvatars, type PlayerFace } from "@/hooks/queries/usePlayerAvatars";
import { ShuttleIcon } from "@/components/match/MatchPrimitives";

/**
 * Compact match bar (BWF Match Centre style) that slides in under the app's
 * top bar once the main score card scrolls away: photos, the live game score
 * with a shuttle on the side serving next, or games won once decided. It
 * repeats the score card, so it is hidden from screen readers.
 */

/** Height of the app's sticky top bar, kept current as it shrinks on scroll. */
function useStickyNavHeight(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const nav = Array.from(document.querySelectorAll("nav")).find((n) => getComputedStyle(n).position === "sticky");
    if (!nav) return;
    const update = () => setH(Math.round(nav.getBoundingClientRect().height));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);
  return h;
}

function initials(name: string): string {
  return (
    name
      .split(/[\s&/]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function Face({ face, fallbackName }: { face?: PlayerFace; fallbackName: string }) {
  const [broken, setBroken] = useState(false);
  const ring = "w-8 h-8 rounded-full ring-2 ring-background bg-muted shrink-0";
  if (face?.avatarUrl && !broken) {
    return <img src={face.avatarUrl} alt="" loading="lazy" onError={() => setBroken(true)} className={`${ring} object-cover`} />;
  }
  return (
    <span className={`${ring} inline-flex items-center justify-center text-[10px] font-black text-soft`}>
      {initials(face?.name || fallbackName)}
    </span>
  );
}

function SideMini({ side, faces, align }: { side: MatchSide; faces: Record<string, PlayerFace> | undefined; align: "left" | "right" }) {
  const ids = side.playerIds.length > 0 ? side.playerIds : [""];
  return (
    <div className={`min-w-0 flex items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className={`flex ${align === "right" ? "flex-row-reverse -space-x-2 space-x-reverse" : "-space-x-2"}`}>
        {ids.map((id, i) => (
          <Face key={id || i} face={id ? faces?.[id] : undefined} fallbackName={side.label} />
        ))}
      </span>
      <span className={`min-w-0 truncate text-xs ${side.isWinner ? "font-black" : "font-semibold text-soft"}`}>{side.label}</span>
    </div>
  );
}

function ScoreMini({ view, serving }: { view: MatchView; serving: 1 | 2 | null }) {
  const games = view.games;
  if (view.state === "live" && games.length > 0) {
    const cur = games[games.length - 1];
    return (
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5 font-mono text-lg font-black tabular-nums leading-none">
          <span className="w-3.5 text-live">{serving === 1 && <ShuttleIcon className="w-3.5 h-3.5" />}</span>
          <span>{cur.side1}</span>
          <span className="text-muted-foreground">–</span>
          <span>{cur.side2}</span>
          <span className="w-3.5 text-live">{serving === 2 && <ShuttleIcon className="w-3.5 h-3.5" />}</span>
        </div>
        <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-live">G{games.length} · Live</p>
      </div>
    );
  }
  if ((view.state === "completed" || view.state === "walkover") && games.length > 0) {
    const won1 = games.filter((g) => g.side1 > g.side2).length;
    const won2 = games.filter((g) => g.side2 > g.side1).length;
    return (
      <div className="text-center">
        <p className="font-mono text-lg font-black tabular-nums leading-none">
          {won1}–{won2}
        </p>
        <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">{view.statusLabel}</p>
      </div>
    );
  }
  return (
    <div className="text-center">
      <p className="text-sm font-black text-muted-foreground leading-none">vs</p>
      <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">{view.statusLabel}</p>
    </div>
  );
}

export function MatchStickyHeader({
  view,
  watch,
  serving,
}: {
  view: MatchView;
  /** The main score card; the bar shows once it has scrolled under the top bar. */
  watch: RefObject<HTMLElement | null>;
  serving: 1 | 2 | null;
}) {
  const navH = useStickyNavHeight();
  const [shown, setShown] = useState(false);
  const faces = usePlayerAvatars([...view.sides[0].playerIds, ...view.sides[1].playerIds]);

  useEffect(() => {
    const el = watch.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setShown(!e.isIntersecting && e.boundingClientRect.top < navH + 1),
      { rootMargin: `-${navH}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [watch, navH]);

  return (
    <div
      aria-hidden
      data-testid="match-sticky-header"
      data-shown={shown}
      className={`fixed inset-x-0 z-40 transition-[opacity,transform] duration-200 ${shown ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}
      style={{ top: navH }}
    >
      <div className="bg-background border-b border-border shadow-sm">
        <div className="container mx-auto max-w-2xl px-4 py-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <SideMini side={view.sides[0]} faces={faces.data} align="left" />
          <ScoreMini view={view} serving={serving} />
          <SideMini side={view.sides[1]} faces={faces.data} align="right" />
        </div>
      </div>
    </div>
  );
}
