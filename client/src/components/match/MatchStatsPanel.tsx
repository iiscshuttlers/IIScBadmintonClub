import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import type { GameFlow, Rally, RallyStats, Tally } from "@/lib/pointLog";

/**
 * Stats tab pieces, all drawn from the stored point log. Side 1 is always on
 * the left in blue, side 2 on the right in orange (the worm chart's colours),
 * so position names the side as well as colour. Values are text in ink, not
 * in the series colour. Colours come from the `.worm-root` variables that
 * MatchPointsTab defines.
 */

const pct = (t: Tally) => (t.of > 0 ? Math.round((t.won / t.of) * 100) : null);

/** One whole split in two, with a 2px gap; each part's length is its share. */
export function SplitBar({ a, b, thick = false }: { a: number; b: number; thick?: boolean }) {
  const h = thick ? "h-3" : "h-2";
  if (a + b <= 0) return <div className={`${h} w-full rounded-full bg-[var(--worm-grid)]`} aria-hidden />;
  return (
    <div className={`${h} w-full flex gap-[2px]`} aria-hidden>
      {a > 0 && <div className="rounded-full" style={{ flex: `${a} 1 0`, background: "var(--worm-s1)" }} />}
      {b > 0 && <div className="rounded-full" style={{ flex: `${b} 1 0`, background: "var(--worm-s2)" }} />}
    </div>
  );
}

function Swatch({ side }: { side: 1 | 2 }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: side === 1 ? "var(--worm-s1)" : "var(--worm-s2)" }}
      aria-hidden
    />
  );
}

/** The headline: points won by each side and their share of the rallies. */
export function PointsHeadline({ stats, names }: { stats: RallyStats; names: [string, string] }) {
  const [a, b] = stats.sides;
  const total = a.pointsWon + b.pointsWon;
  const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <section aria-labelledby="pts-heading">
      <h2 id="pts-heading" className="sr-only">
        Points won
      </h2>
      <p className="sr-only">
        {names[0]} won {a.pointsWon} points ({share(a.pointsWon)}%), {names[1]} won {b.pointsWon} ({share(b.pointsWon)}%), out of {total}.
      </p>
      <div aria-hidden>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div className="min-w-0">
            <p className="text-4xl font-black tabular-nums leading-none">{a.pointsWon}</p>
            <p className="mt-1 flex items-start gap-1.5 text-xs font-bold min-w-0">
              <span className="mt-[3px]">
                <Swatch side={1} />
              </span>
              <span className="line-clamp-2 break-words">{names[0]}</span>
            </p>
          </div>
          <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground text-center pb-5">
            Points won
            <span className="block normal-case tracking-normal font-semibold">{total} played</span>
          </p>
          <div className="min-w-0 text-right">
            <p className="text-4xl font-black tabular-nums leading-none">{b.pointsWon}</p>
            <p className="mt-1 flex items-start justify-end gap-1.5 text-xs font-bold min-w-0">
              <span className="line-clamp-2 break-words">{names[1]}</span>
              <span className="mt-[3px]">
                <Swatch side={2} />
              </span>
            </p>
          </div>
        </div>
        <div className="mt-3">
          <SplitBar a={a.pointsWon} b={b.pointsWon} thick />
        </div>
        <div className="mt-1 flex justify-between text-xs font-black tabular-nums text-muted-foreground">
          <span>{share(a.pointsWon)}%</span>
          <span>{share(b.pointsWon)}%</span>
        </div>
      </div>
    </section>
  );
}

export function Takeaways({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <section aria-labelledby="takeaways-heading" className="rounded-2xl border border-border bg-background/60 p-4">
      <h2 id="takeaways-heading" className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
        <Lightbulb className="w-3.5 h-3.5" aria-hidden /> Takeaways
      </h2>
      <ul className="space-y-1.5 text-sm">
        {lines.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-2 w-1 h-1 rounded-full bg-muted-foreground shrink-0" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface Cell {
  main: string;
  sub?: string;
}

interface Row {
  label: string;
  left: Cell;
  right: Cell;
  /** Bar weights; the larger one is the row's leader (bold). */
  a: number;
  b: number;
}

function tallyCell(t: Tally): Cell {
  const p = pct(t);
  return p == null ? { main: "—" } : { main: `${p}%`, sub: `${t.won} of ${t.of}` };
}

function buildRows(stats: RallyStats): Row[] {
  const [a, b] = stats.sides;
  const rows: Row[] = [];
  const total = stats.rallies;
  const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  if (a.onServe.of + b.onServe.of > 0) {
    rows.push({ label: "Won on serve", left: tallyCell(a.onServe), right: tallyCell(b.onServe), a: pct(a.onServe) ?? 0, b: pct(b.onServe) ?? 0 });
    rows.push({ label: "Won on receive", left: tallyCell(a.onReceive), right: tallyCell(b.onReceive), a: pct(a.onReceive) ?? 0, b: pct(b.onReceive) ?? 0 });
  }
  rows.push({ label: "In the lead", left: { main: `${share(a.ralliesAhead)}%` }, right: { main: `${share(b.ralliesAhead)}%` }, a: a.ralliesAhead, b: b.ralliesAhead });
  rows.push({ label: "Most points in a row", left: { main: String(a.longestRun) }, right: { main: String(b.longestRun) }, a: a.longestRun, b: b.longestRun });
  rows.push({ label: "Biggest lead", left: { main: String(a.biggestLead) }, right: { main: String(b.biggestLead) }, a: a.biggestLead, b: b.biggestLead });
  if (a.gamePoints.of + b.gamePoints.of > 0) {
    rows.push({
      label: "Game points won",
      left: { main: `${a.gamePoints.won} of ${a.gamePoints.of}` },
      right: { main: `${b.gamePoints.won} of ${b.gamePoints.of}` },
      a: a.gamePoints.of,
      b: b.gamePoints.of,
    });
  }
  if (a.crunch.of > 0) {
    rows.push({ label: `Points from ${stats.crunchFrom}-all`, left: { main: String(a.crunch.won) }, right: { main: String(b.crunch.won) }, a: a.crunch.won, b: b.crunch.won });
  }
  return rows;
}

/** Head-to-head numbers as split bars (BWF "more details", with shares). */
export function CompareRows({ stats, names }: { stats: RallyStats; names: [string, string] }) {
  const rows = useMemo(() => buildRows(stats), [stats]);
  return (
    <section aria-labelledby="h2h-num-heading">
      <h2 id="h2h-num-heading" className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
        Head to head
      </h2>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const lead = r.a === r.b ? 0 : r.a > r.b ? 1 : 2;
          return (
            <li key={r.label} className="py-2.5">
              <p className="sr-only">
                {r.label}: {names[0]} {r.left.main}
                {r.left.sub ? ` (${r.left.sub})` : ""}, {names[1]} {r.right.main}
                {r.right.sub ? ` (${r.right.sub})` : ""}.
              </p>
              <div aria-hidden>
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                  <p className="min-w-0">
                    <span className={`text-lg tabular-nums leading-none ${lead === 1 ? "font-black" : "font-semibold text-muted-foreground"}`}>{r.left.main}</span>
                    {r.left.sub && <span className="block text-[11px] text-muted-foreground tabular-nums">{r.left.sub}</span>}
                  </p>
                  <p className="text-center pt-0.5 text-[11px] font-black uppercase tracking-wide text-soft max-w-[13rem]">{r.label}</p>
                  <p className="min-w-0 text-right">
                    <span className={`text-lg tabular-nums leading-none ${lead === 2 ? "font-black" : "font-semibold text-muted-foreground"}`}>{r.right.main}</span>
                    {r.right.sub && <span className="block text-[11px] text-muted-foreground tabular-nums">{r.right.sub}</span>}
                  </p>
                </div>
                <div className="mt-2">
                  <SplitBar a={r.a} b={r.b} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {stats.sides[0].onServe.of + stats.sides[1].onServe.of > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">Serve stats skip the first point of the match: who served it isn't recorded.</p>
      )}
    </section>
  );
}

const LW = 320;
const LH = 150;
const LPAD = { l: 22, r: 6, t: 16, b: 8 };

/**
 * Lead tracker (FotMob-style momentum): the lead after every point. Above the
 * line, side 1 is ahead (blue); below, side 2 (orange). Each game restarts at
 * level; dashed lines split the games.
 */
export function LeadTracker({ rallies, names, gameNumbers }: { rallies: Rally[]; names: [string, string]; gameNumbers: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const GAP = 3; // rally-widths between games
  const layout = useMemo(() => {
    const items: Array<{ r: Rally; x0: number; x1: number; idxInGame: number }> = [];
    const starts: Array<{ game: number; x: number }> = [];
    let x = 0;
    for (const g of gameNumbers) {
      const list = rallies.filter((r) => r.game === g);
      if (list.length === 0) continue;
      if (starts.length > 0) x += GAP;
      starts.push({ game: g, x });
      list.forEach((r, i) => {
        items.push({ r, x0: x, x1: x + 1, idxInGame: i + 1 });
        x += 1;
      });
    }
    const maxLead = Math.max(3, ...items.map((it) => Math.abs(it.r.t1 - it.r.t2)));
    return { items, starts, units: Math.max(1, x), maxLead };
  }, [rallies, gameNumbers]);

  const { items, starts, units, maxLead } = layout;
  if (items.length === 0) return null;
  const plotW = LW - LPAD.l - LPAD.r;
  const mid = LPAD.t + (LH - LPAD.t - LPAD.b) / 2;
  const half = (LH - LPAD.t - LPAD.b) / 2;
  const sx = (u: number) => LPAD.l + (u / units) * plotW;
  const sy = (lead: number) => mid - (lead / maxLead) * half;

  // One closed step-area per game.
  const areas = starts.map((s, si) => {
    const inGame = items.filter((it) => it.r.game === s.game);
    let d = `M${sx(s.x)},${mid}`;
    for (const it of inGame) {
      const y = sy(it.r.t1 - it.r.t2);
      d += ` L${sx(it.x0)},${y} L${sx(it.x1)},${y}`;
    }
    d += ` L${sx(inGame[inGame.length - 1].x1)},${mid} Z`;
    return { key: `${s.game}-${si}`, d };
  });

  const ahead = (k: 0 | 1) => items.filter((it) => (k === 0 ? it.r.t1 > it.r.t2 : it.r.t2 > it.r.t1)).length;
  const best = (k: 0 | 1) => Math.max(0, ...items.map((it) => (k === 0 ? it.r.t1 - it.r.t2 : it.r.t2 - it.r.t1)));
  const hovered = hover != null ? items[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * LW;
    const u = ((px - LPAD.l) / plotW) * units;
    let bestI = -1;
    let bestD = Infinity;
    for (let i = 0; i < items.length; i += 1) {
      const d = Math.abs((items[i].x0 + items[i].x1) / 2 - u);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    setHover(bestI >= 0 && bestD <= GAP ? bestI : null);
  };

  const clipId = `lt-${gameNumbers.join("-")}`;
  return (
    <section aria-labelledby="lead-heading">
      <h2 id="lead-heading" className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
        Who was ahead
      </h2>
      <figure className="relative">
        <svg
          viewBox={`0 0 ${LW} ${LH}`}
          className="w-full h-auto touch-none"
          role="img"
          aria-label={`Who led after each point. ${names[0]} led after ${ahead(0)} points (biggest lead ${best(0)}); ${names[1]} after ${ahead(1)} (biggest lead ${best(1)}).`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={`${clipId}-top`}>
              <rect x={0} y={0} width={LW} height={mid} />
            </clipPath>
            <clipPath id={`${clipId}-bot`}>
              <rect x={0} y={mid} width={LW} height={LH - mid} />
            </clipPath>
          </defs>
          {[maxLead, -maxLead].map((v) => (
            <g key={v}>
              <line x1={LPAD.l} x2={LW - LPAD.r} y1={sy(v)} y2={sy(v)} stroke="var(--worm-grid)" strokeDasharray="2 3" />
              <text x={LPAD.l - 4} y={sy(v) + 3} textAnchor="end" fontSize={9} fill="var(--worm-muted)">
                +{maxLead}
              </text>
            </g>
          ))}
          {starts.slice(1).map((s) => (
            <line key={s.game} x1={sx(s.x - GAP / 2)} x2={sx(s.x - GAP / 2)} y1={LPAD.t - 4} y2={LH - LPAD.b} stroke="var(--worm-muted)" strokeDasharray="3 3" strokeWidth={1} />
          ))}
          {starts.length > 1 &&
            starts.map((s) => (
              <text key={`l${s.game}`} x={sx(s.x) + 2} y={LPAD.t - 5} fontSize={9} fontWeight={800} fill="var(--worm-muted)">
                G{s.game}
              </text>
            ))}
          {areas.map((a) => (
            <g key={a.key}>
              <path d={a.d} fill="var(--worm-s1)" clipPath={`url(#${clipId}-top)`} />
              <path d={a.d} fill="var(--worm-s2)" clipPath={`url(#${clipId}-bot)`} />
            </g>
          ))}
          <line x1={LPAD.l} x2={LW - LPAD.r} y1={mid} y2={mid} stroke="var(--worm-ink)" strokeOpacity={0.5} strokeWidth={1} />
          <text x={LPAD.l - 4} y={mid + 3} textAnchor="end" fontSize={9} fill="var(--worm-muted)">
            0
          </text>
          {hovered && (
            <line x1={sx((hovered.x0 + hovered.x1) / 2)} x2={sx((hovered.x0 + hovered.x1) / 2)} y1={LPAD.t} y2={LH - LPAD.b} stroke="var(--worm-ink)" strokeWidth={1} />
          )}
        </svg>
        <figcaption className="mt-1 flex justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <Swatch side={1} />
            <span className="truncate">Above: {names[0]} leads</span>
          </span>
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <span className="truncate">Below: {names[1]} leads</span>
            <Swatch side={2} />
          </span>
        </figcaption>
        {hovered && (
          <div className="pointer-events-none absolute top-0 right-0 rounded-lg bg-foreground text-background text-[11px] font-semibold px-2 py-1 shadow">
            G{hovered.r.game}, point {hovered.idxInGame}: {hovered.r.t1}–{hovered.r.t2}
            {hovered.r.t1 !== hovered.r.t2 ? ` · ${hovered.r.t1 > hovered.r.t2 ? names[0] : names[1]} +${Math.abs(hovered.r.t1 - hovered.r.t2)}` : " · level"}
          </div>
        )}
      </figure>
    </section>
  );
}

/** Game by game: interval score, lead changes, best run and length. */
export function GameFlowTable({ flows, names, intervalPoint }: { flows: GameFlow[]; names: [string, string]; intervalPoint: number }) {
  if (flows.length < 2) return null;
  return (
    <section aria-labelledby="flow-heading">
      <h2 id="flow-heading" className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
        Game by game
      </h2>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Each game: final score, score at {intervalPoint}, lead changes, most points in a row, and time. Scores show {names[0]} first.
          </caption>
          <thead>
            <tr className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="text-left py-1 pr-2">Game</th>
              <th scope="col" className="text-right py-1 px-2">Score</th>
              <th scope="col" className="text-right py-1 px-2">At {intervalPoint}</th>
              <th scope="col" className="text-right py-1 px-2">Lead changes</th>
              <th scope="col" className="text-right py-1 px-2">Best run</th>
              <th scope="col" className="text-right py-1 pl-2">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {flows.map((f) => {
              const intervalLeader = f.atInterval ? (f.atInterval[0] > f.atInterval[1] ? 1 : 2) : null;
              return (
                <tr key={f.game}>
                  <th scope="row" className="text-left py-2 pr-2 font-black">
                    G{f.game}
                  </th>
                  <td className="text-right py-2 px-2 font-mono whitespace-nowrap">
                    <span className={f.winner === 1 ? "font-black" : "text-muted-foreground"}>{f.final[0]}</span>–
                    <span className={f.winner === 2 ? "font-black" : "text-muted-foreground"}>{f.final[1]}</span>
                  </td>
                  <td className="text-right py-2 px-2 font-mono whitespace-nowrap">
                    {f.atInterval ? (
                      <span className="inline-flex items-center gap-1">
                        {intervalLeader && <Swatch side={intervalLeader} />}
                        {f.atInterval[0]}–{f.atInterval[1]}
                        {intervalLeader && <span className="sr-only">, {names[intervalLeader - 1]} ahead</span>}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-right py-2 px-2">{f.leadChanges}</td>
                  <td className="text-right py-2 px-2 whitespace-nowrap">
                    {f.longestRun ? (
                      <span className="inline-flex items-center gap-1">
                        <Swatch side={f.longestRun.side} />
                        {f.longestRun.length}
                        <span className="sr-only"> by {names[f.longestRun.side - 1]}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-right py-2 pl-2 whitespace-nowrap text-muted-foreground">{f.minutes ? `${f.minutes} min` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
