import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { playerService } from "@/services/playerService";
import { fetchComparisonRows } from "@/services/comparisonService";
import { Swords, Trophy, Activity, BarChart3, ChevronDown, ChevronRight, User, Users, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { calculateRanksMap } from "@/lib/rankingUtils";
import { PlayerSelect } from "@/components/ui/PlayerSelect";
import { Avatar } from "@/components/ui/Avatar";
import { sampleNote, winnerOf, type ComparisonMeeting } from "@/lib/comparison";
import { matchPath } from "@/lib/tournamentRoutes";
import {
  H2H_FORMATS,
  compareByFormat,
  currentRun,
  gamesFromA,
  latestPartners,
  pointsAndStreaks,
  sideRating,
  winChancePct,
  type H2HFormat,
} from "@/lib/h2hFormats";
import {
  PAIR_KIND_LABELS,
  PAIR_KIND_NEEDS,
  genderOf,
  misfitOnSecondSide,
  possibleKinds,
  settledKind,
} from "@/lib/pairRules";

type Mode = "players" | "pairs";
type Ranks = { overall: number; singles: number; doubles: number; mixed: number };

/** Left side (A) and right side (B) wear the scoreboard team colours everywhere. */
const SIDE = {
  a: { text: "text-team-1", bg: "bg-team-1", ring: "ring-team-1" },
  b: { text: "text-team-2", bg: "bg-team-2", ring: "ring-team-2" },
} as const;
type SideKey = keyof typeof SIDE;

const SEARCH_CLASS =
  "w-full rounded-lg border border-border-strong bg-muted px-3 py-2 text-center text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary";

const RANK_ROWS: { key: keyof Ranks; label: string; format: H2HFormat }[] = [
  { key: "overall", label: "Overall rank", format: "All" },
  { key: "singles", label: "Singles rank", format: "Singles" },
  { key: "doubles", label: "Doubles rank", format: "Doubles" },
  { key: "mixed", label: "Mixed rank", format: "Mixed" },
];

/**
 * Players directory → H2H. Two players compared per format (All / Singles /
 * Doubles / Mixed), or two pairs, whose genders decide the event: the left
 * pair sets men's, women's or mixed doubles and the right pair must match
 * (lib/pairRules). Shared WP8 rules (lib/comparison via lib/h2hFormats), so
 * totals match /h2h and the profile.
 */
export function H2HSection() {
  const { session } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [p1Id, setP1Id] = useState<string>("");
  const [p2Id, setP2Id] = useState<string>("");
  const [partner1Id, setPartner1Id] = useState<string>("");
  const [partner2Id, setPartner2Id] = useState<string>("");
  const [mode, setMode] = useState<Mode>("players");
  const [format, setFormat] = useState<H2HFormat>("All");
  const [loading, setLoading] = useState(true);

  const rankMap = useMemo(() => calculateRanksMap(players), [players]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id as string, p])), [players]);

  useEffect(() => {
    playerService.getAllPublicPlayers()
      .then((data) => {
        if (data) {
          setPlayers(data.sort((a, b) => b.elo_rating - a.elo_rating));
          if (data.length >= 2) {
            const currentUserId = session?.user?.id;
            const hasCurrentUser = data.find(p => p.id === currentUserId);
            if (hasCurrentUser && currentUserId) {
              setP1Id(currentUserId);
              setP2Id(data.find(p => p.id !== currentUserId)?.id || data[1].id);
            } else {
              setP1Id(data[0].id);
              setP2Id(data[1].id);
            }
          }
        }
        setLoading(false);
      });
  }, [session?.user?.id]);

  // Every match containing both players (any format, any partner). Pair and
  // format views are filtered from these rows. Same query as the profile's
  // head-to-head widget, so the cache is shared.
  const comparison = useQuery({
    queryKey: ["tournament_matches", "comparison", p1Id, p2Id],
    queryFn: () => fetchComparisonRows({ ids: [p1Id] }, { ids: [p2Id] }),
    enabled: !!p1Id && !!p2Id && p1Id !== p2Id,
    staleTime: 60_000,
  });
  const rows = useMemo(() => comparison.data?.rows ?? [], [comparison.data]);

  // A different player is a different pair: drop that side's partner.
  useEffect(() => setPartner1Id(""), [p1Id]);
  useEffect(() => setPartner2Id(""), [p2Id]);

  // Pairs: the left pair sets the event (two men, two women, or one of each)
  // and the right pair's pickers only offer players who fit it.
  const genderOfId = (id: string) => genderOf(byId.get(id));
  const leftGenders = useMemo(
    () => [p1Id, partner1Id].filter(Boolean).map((id) => genderOf(byId.get(id))),
    [p1Id, partner1Id, byId],
  );
  const pairEvent =
    mode === "pairs" ? settledKind(leftGenders, [p2Id, partner2Id].filter(Boolean).map(genderOfId)) : null;
  const rightPlayerOptions = useMemo(
    () =>
      mode === "pairs"
        ? players.filter((p) => possibleKinds(leftGenders, [genderOf(p)]).length > 0)
        : players,
    [mode, players, leftGenders],
  );
  const rightPartnerOptions = useMemo(() => {
    const main = p2Id ? [genderOf(byId.get(p2Id))] : [];
    return players.filter((p) => p.id !== p2Id && possibleKinds(leftGenders, [...main, genderOf(p)]).length > 0);
  }, [players, leftGenders, p2Id, byId]);
  const leftPartnerOptions = useMemo(() => players.filter((p) => p.id !== p1Id), [players, p1Id]);

  // When the left pair changes, drop right-side picks that no longer fit.
  useEffect(() => {
    if (mode !== "pairs" || !byId.size) return;
    const misfit = misfitOnSecondSide(
      leftGenders,
      p2Id ? genderOf(byId.get(p2Id)) : undefined,
      partner2Id ? genderOf(byId.get(partner2Id)) : undefined,
    );
    if (misfit === "player") setP2Id(""); // its partner goes with it
    else if (misfit === "partner") setPartner2Id("");
  }, [mode, leftGenders, p2Id, partner2Id, byId]);

  // Prefill the right partner (and the left one, if empty) from the two
  // players' last doubles or mixed meeting, keeping a left partner already picked.
  useEffect(() => {
    if (mode !== "pairs" || !rows.length || partner2Id) return;
    const last = latestPartners(rows, p1Id, p2Id, "All", partner1Id || undefined);
    if (!last) return;
    // Skip a meeting the recorded genders don't allow, or the misfit check
    // above would clear it again.
    const g = (id: string) => genderOf(byId.get(id));
    if (possibleKinds([g(p1Id), g(last.aPartner)], [g(p2Id), g(last.bPartner)]).length === 0) return;
    if (!partner1Id) setPartner1Id(last.aPartner);
    setPartner2Id(last.bPartner);
  }, [mode, rows, p1Id, p2Id, partner1Id, partner2Id, byId]);

  // A pair comparison has one event, so its format follows the pairs.
  const activeFormat: H2HFormat =
    mode === "pairs" ? (pairEvent === "XD" ? "Mixed" : pairEvent ? "Doubles" : "All") : format;
  const formatLabel = mode === "pairs" ? (pairEvent ? PAIR_KIND_LABELS[pairEvent] : "") : format === "All" ? "" : format;

  const sideA = mode === "pairs" ? [p1Id, partner1Id] : [p1Id];
  const sideB = mode === "pairs" ? [p2Id, partner2Id] : [p2Id];
  const pairsIncomplete = mode === "pairs" && (!partner1Id || !partner2Id);
  const pairsClash = mode === "pairs" && !pairsIncomplete && new Set([...sideA, ...sideB]).size < 4;
  const samePlayer = !!p1Id && p1Id === p2Id;
  const ready = !!p1Id && !!p2Id && !samePlayer && !pairsIncomplete && !pairsClash;

  const aKey = sideA.join(",");
  const bKey = sideB.join(",");
  const byFormat = useMemo(
    () => (ready ? compareByFormat(rows, { ids: aKey.split(",") }, { ids: bKey.split(",") }) : null),
    [ready, rows, aKey, bKey],
  );
  const result = byFormat?.[activeFormat] ?? null;
  const p1Wins = result?.aWins ?? 0;
  const p2Wins = result?.bWins ?? 0;
  const totalMatchesPlayed = result?.sample ?? 0;
  const walkoverCount = result ? result.walkovers.aWon + result.walkovers.bWon : 0;
  const history = useMemo(() => result?.meetings.filter((m) => m.eligibility !== "excluded") ?? [], [result]);
  const pointStats = useMemo(
    () => (result ? pointsAndStreaks(result) : { aPoints: 0, bPoints: 0, aBestRun: 0, bBestRun: 0 }),
    [result],
  );
  const run = useMemo(() => (result ? currentRun(result) : null), [result]);
  const loadingMatches = ready && comparison.isLoading;

  const nameOf = (id: string | null | undefined) => (id ? byId.get(id)?.full_name ?? "" : "");
  const labelOf = (ids: string[]) => ids.map(nameOf).filter(Boolean).join(" & ");
  const labelA = labelOf(sideA);
  const labelB = labelOf(sideB);
  const inFormat = formatLabel ? ` in ${formatLabel.toLowerCase()}` : "";

  // One plain sentence on where the rivalry stands (or what's missing).
  const rivalryLine = useMemo(() => {
    if (!p1Id || !p2Id) return "Choose two players to compare.";
    if (samePlayer) return "Pick two different players.";
    if (pairsIncomplete) return "Choose a partner for each player to compare the pairs.";
    if (pairsClash) return "Pick four different players to compare two pairs.";
    const plural = mode === "pairs";
    const total = p1Wins + p2Wins;
    if (total === 0) return `No counted matches yet${inFormat}. The odds below come from their ratings.`;
    const leader = p1Wins > p2Wins ? labelA : labelB;
    const lw = Math.max(p1Wins, p2Wins);
    const tw = Math.min(p1Wins, p2Wins);
    let line: string;
    if (total === 1) line = `${leader} won the only meeting so far${inFormat}.`;
    else if (p1Wins === p2Wins) line = `Level at ${p1Wins}–${p2Wins}${inFormat}. The next match breaks the tie.`;
    else if (lw >= 5 && lw - tw >= 3) line = `${leader} ${plural ? "dominate" : "dominates"} this rivalry ${lw}–${tw}${inFormat}.`;
    else line = `${leader} ${plural ? "lead" : "leads"} ${lw}–${tw}${inFormat}.`;
    if (total >= 2 && run && run.length >= 2) {
      line += ` ${run.aWon ? labelA : labelB} ${plural ? "have" : "has"} won the last ${run.length}.`;
    }
    return line;
  }, [p1Id, p2Id, samePlayer, pairsIncomplete, pairsClash, p1Wins, p2Wins, labelA, labelB, inFormat, mode, run]);

  // Rating for this format (a pair's is the mean of its two players).
  const ratingA = sideRating(sideA.map((id) => byId.get(id)), activeFormat);
  const ratingB = sideRating(sideB.map((id) => byId.get(id)), activeFormat);
  const p1WinProb = winChancePct(ratingA, ratingB);
  const p2WinProb = 100 - p1WinProb;

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Activity className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  const fullPageHref = `/h2h?a=${sideA.join(",")}&b=${sideB.join(",")}${mode === "pairs" ? "&mode=pairs" : ""}`;
  const ranksA: Ranks | undefined = rankMap[p1Id];
  const ranksB: Ranks | undefined = rankMap[p2Id];
  const together = mode === "players" ? result?.together : null;
  const note = sampleNote(totalMatchesPlayed);
  const form = result ? [...result.formA].reverse() : []; // oldest → newest

  return (
    <div className="font-sans animate-in fade-in zoom-in-95 duration-300 space-y-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center justify-center gap-2">
            <Swords className="w-6 h-6 text-primary" /> Head-to-Head
          </h1>
        </div>

        {/* Players or pairs */}
        <div className="flex justify-center">
          <div className="bg-muted/50 p-1 rounded-xl flex gap-1 border border-border" role="group" aria-label="Compare">
            {(["players", "pairs"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-[44px] flex items-center gap-1.5 px-4 rounded-lg text-sm font-bold transition-all ${mode === m ? "bg-muted-strong text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m === "players" ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                {m === "players" ? "Players" : "Pairs"}
              </button>
            ))}
          </div>
        </div>

        {/* Players: format, with each format's record. Pairs: the event the pairs make. */}
        {mode === "pairs" ? (
          <div className="text-center space-y-1" aria-live="polite">
            <span className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-xl border border-border-strong text-sm font-bold text-foreground">
              <Users className="w-4 h-4 text-primary" aria-hidden />
              {pairEvent ? PAIR_KIND_LABELS[pairEvent] : "Doubles & mixed"}
            </span>
            <p className="text-xs text-muted-foreground">
              {pairEvent
                ? `The right pair must be ${PAIR_KIND_NEEDS[pairEvent]}.`
                : "Two men, two women, or a man and a woman: the right pair must match the left."}
            </p>
          </div>
        ) : (
          <div
            className="mx-auto grid max-w-md grid-cols-4 gap-1 rounded-xl border border-border bg-muted/50 p-1"
            role="group"
            aria-label="Format"
          >
            {H2H_FORMATS.map((f) => {
              const r = byFormat?.[f];
              const active = format === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFormat(f)}
                  className={`min-h-[44px] flex flex-col items-center justify-center rounded-lg px-1 py-1 transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <span className="text-xs sm:text-sm font-bold leading-tight">{f}</span>
                  <span className={`text-[11px] font-black tabular-nums leading-tight ${active ? "" : "text-soft"}`}>
                    {r && r.sample > 0 ? `${r.aWins}–${r.bWins}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <section className="bg-card rounded-2xl shadow-sm border border-border" aria-label="Head-to-head summary">
          {/* The matchup: each side, and the series score between them */}
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-6">
              <SidePicker
                side="a"
                playerId={p1Id}
                onPlayer={setP1Id}
                partnerId={partner1Id}
                onPartner={setPartner1Id}
                pairs={mode === "pairs"}
                players={players}
                partners={leftPartnerOptions}
                byId={byId}
                placeholder="Player 1"
              />

              <div className="flex min-w-[5.5rem] flex-col items-center pt-4 sm:pt-7 text-center">
                {loadingMatches ? (
                  <Activity className="w-8 h-8 animate-spin text-primary my-2" aria-label="Loading matches" />
                ) : (
                  <div
                    className="flex items-baseline gap-1.5 sm:gap-2 text-4xl sm:text-5xl font-black tabular-nums leading-none"
                    aria-label={`Wins: ${labelA || "player 1"} ${p1Wins}, ${labelB || "player 2"} ${p2Wins}`}
                  >
                    <span className={p1Wins > p2Wins ? SIDE.a.text : "text-foreground"}>{p1Wins}</span>
                    <span className="text-2xl sm:text-3xl text-faint" aria-hidden>–</span>
                    <span className={p2Wins > p1Wins ? SIDE.b.text : "text-foreground"}>{p2Wins}</span>
                  </div>
                )}
                <div className="mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {totalMatchesPlayed} {totalMatchesPlayed === 1 ? "match" : "matches"}
                  {formatLabel && (
                    <>
                      <span className="hidden sm:inline"> · </span>
                      <span className="block sm:inline">{formatLabel}</span>
                    </>
                  )}
                </div>
                {walkoverCount > 0 && (
                  <div className="mt-1 text-[10px] font-bold text-muted-foreground">
                    + {walkoverCount} walkover{walkoverCount === 1 ? "" : "s"}, not counted
                  </div>
                )}
                {form.length >= 2 && (
                  <div className="mt-3 flex items-center gap-1" aria-label={`Last ${form.length} results, oldest first`}>
                    {form.map((r, i) => (
                      <span
                        key={i}
                        className={`h-2.5 w-2.5 rounded-full ${r === "W" ? SIDE.a.bg : SIDE.b.bg} ${i === form.length - 1 ? "ring-2 ring-offset-2 ring-offset-card ring-border-strong" : ""}`}
                        title={r === "W" ? `${labelA} won` : `${labelB} won`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <SidePicker
                side="b"
                playerId={p2Id}
                onPlayer={setP2Id}
                partnerId={partner2Id}
                onPartner={setPartner2Id}
                pairs={mode === "pairs"}
                players={rightPlayerOptions}
                partners={rightPartnerOptions}
                byId={byId}
                placeholder="Player 2"
              />
            </div>

            {!loadingMatches && (
              <p className="mt-4 text-center text-sm font-semibold text-soft text-balance" aria-live="polite">
                {rivalryLine}
              </p>
            )}
            {comparison.isError && (
              <p className="mt-2 text-center text-xs font-bold text-danger">Couldn't load matches. Try again later.</p>
            )}
          </div>

          {/* Tale of the tape: this matchup, then ratings and ranks */}
          {ready && !loadingMatches && (
            <div
              className={`grid grid-cols-1 gap-x-10 gap-y-6 border-t border-border px-4 py-5 sm:px-6 ${mode === "players" ? "md:grid-cols-2" : ""}`}
            >
              <TapeGroup
                title={`This matchup${formatLabel ? ` · ${formatLabel}` : ""}`}
                className={mode === "pairs" ? "mx-auto w-full max-w-xl" : ""}
              >
                {totalMatchesPlayed > 0 && (
                  <>
                    <TapeRow label="Wins" a={p1Wins} b={p2Wins} bar names={[labelA, labelB]} />
                    {(pointStats.aPoints > 0 || pointStats.bPoints > 0) && (
                      <TapeRow label="Points won" a={pointStats.aPoints} b={pointStats.bPoints} bar names={[labelA, labelB]} />
                    )}
                    {totalMatchesPlayed >= 2 && (
                      <TapeRow label="Longest win streak" a={pointStats.aBestRun} b={pointStats.bBestRun} names={[labelA, labelB]} />
                    )}
                  </>
                )}
                <TapeRow
                  label="Win chance"
                  hint="next match, from ratings"
                  a={p1WinProb}
                  b={p2WinProb}
                  display={(v) => `${v}%`}
                  bar
                  names={[labelA, labelB]}
                />
                {mode === "pairs" && (
                  <TapeRow label="Pair rating" hint="average" a={Math.round(ratingA)} b={Math.round(ratingB)} names={[labelA, labelB]} />
                )}
                {together && together.played > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Also partnered in {together.played} {together.played === 1 ? "match" : "matches"}
                    {inFormat}, winning {together.won}.
                  </p>
                )}
              </TapeGroup>

              {mode === "players" && (
              <TapeGroup title="Ratings & ranks">
                <TapeRow
                  label="Rating"
                  hint={activeFormat === "All" ? "overall" : activeFormat.toLowerCase()}
                  a={Math.round(ratingA)}
                  b={Math.round(ratingB)}
                  names={[labelA, labelB]}
                />
                {RANK_ROWS.map((r) => (
                    <TapeRow
                      key={r.key}
                      label={r.label}
                      a={ranksA?.[r.key] || null}
                      b={ranksB?.[r.key] || null}
                      display={(v) => `#${v}`}
                      better="low"
                      active={r.format === activeFormat}
                      names={[labelA, labelB]}
                    />
                  ))}
              </TapeGroup>
              )}
            </div>
          )}

          {ready && !loadingMatches && (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-muted-foreground">
                {note && totalMatchesPlayed > 0 ? note : "Wins count completed tournament matches. Walkovers and byes don't count."}
              </p>
              <Link
                href={mode === "players" ? `/compare/${p1Id}/${p2Id}` : fullPageHref}
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-primary/50 px-4 text-xs font-black uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
              >
                <BarChart3 className="h-4 w-4" aria-hidden />
                {mode === "players" ? "Full analytics" : "Full comparison"}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          )}
        </section>

        {history.length > 0 && (
          <section className="bg-card rounded-2xl p-4 sm:p-5 shadow-sm border border-border" aria-label="Meetings">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                Meetings{formatLabel && ` · ${formatLabel}`}
              </h3>
              <span className="text-xs font-bold text-muted-foreground">
                {history.length} {history.length === 1 ? "match" : "matches"}
              </span>
            </div>
            <ul className="space-y-2">
              {history.map((m) => (
                <li key={`${m.row.source}:${m.row.id}`}>
                  <MeetingCard meeting={m} labelOf={labelOf} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/** One side of the matchup: avatar(s), then the name, which opens a search to change it. */
function SidePicker({
  side,
  playerId,
  onPlayer,
  partnerId,
  onPartner,
  pairs,
  players,
  partners,
  byId,
  placeholder,
}: {
  side: SideKey;
  playerId: string;
  onPlayer: (id: string) => void;
  partnerId: string;
  onPartner: (id: string) => void;
  pairs: boolean;
  /** Who this side's player picker offers. */
  players: any[];
  /** Who this side's partner picker offers. */
  partners: any[];
  byId: Map<string, any>;
  placeholder: string;
}) {
  const [editing, setEditing] = useState<"player" | "partner" | null>(null);
  const player = playerId ? byId.get(playerId) : null;
  const partner = partnerId ? byId.get(partnerId) : null;
  const tone = SIDE[side];
  const avatarSize = pairs ? "w-12 h-12 sm:w-16 sm:h-16 text-base sm:text-xl" : "w-16 h-16 sm:w-24 sm:h-24 text-xl sm:text-3xl";
  const avatarClass = `${avatarSize} ring-2 ${tone.ring} ring-offset-2 ring-offset-card`;
  // The results list is wider than a phone column; open it towards the middle.
  const menuClassName = `min-w-[14rem] ${side === "a" ? "left-0" : "right-0"}`;
  const done = () => setEditing(null);

  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <div className={`flex ${pairs ? "-space-x-3" : ""}`}>
        <SideAvatar person={player} className={avatarClass} />
        {pairs && <SideAvatar person={partner} className={avatarClass} />}
      </div>

      <div className="relative w-full">
        {editing === "player" ? (
          // Opens empty so typing starts a fresh search; the current player
          // stays chosen until another is picked (leaving changes nothing).
          <PlayerSelect
            value=""
            onChange={(id) => id && onPlayer(id)}
            onDone={done}
            autoFocus
            players={players}
            placeholder={`Search ${placeholder.toLowerCase()}`}
            className={SEARCH_CLASS}
            menuClassName={menuClassName}
          />
        ) : (
          <NameButton
            name={player?.full_name}
            placeholder={`Choose ${placeholder.toLowerCase()}`}
            tone={tone.text}
            onClick={() => setEditing("player")}
          />
        )}
      </div>

      {pairs && (
        <div className="relative -mt-1 w-full">
          {editing === "partner" ? (
            <PlayerSelect
              value=""
              onChange={(id) => id && onPartner(id)}
              onDone={done}
              autoFocus
              players={partners}
              placeholder="Search partner"
              className={SEARCH_CLASS}
              menuClassName={menuClassName}
            />
          ) : (
            <NameButton
              name={partner ? `& ${partner.full_name}` : undefined}
              placeholder="Choose partner"
              tone={tone.text}
              small
              onClick={() => setEditing("partner")}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SideAvatar({ person, className }: { person: any; className: string }) {
  if (!person)
    return (
      <div className={`${className} flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground`}>
        <UserPlus className="h-1/3 w-1/3" aria-hidden />
      </div>
    );
  return <Avatar src={person.avatar_url} name={person.full_name} className={className} />;
}

/** A side's name in full (up to two lines); tapping it opens the player search. */
function NameButton({
  name,
  placeholder,
  tone,
  small = false,
  onClick,
}: {
  name: string | undefined;
  placeholder: string;
  tone: string;
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={name ? "Change" : undefined}
      aria-label={name ? `${name}, change` : placeholder}
      className={`mx-auto flex max-w-full items-start justify-center gap-1 rounded-lg px-1.5 py-1 leading-tight transition-colors hover:bg-muted ${
        small ? "text-xs sm:text-sm font-bold" : "text-sm sm:text-lg md:text-xl font-black"
      } ${name ? (small ? "text-soft" : "text-foreground") : "text-muted-foreground"}`}
    >
      <span className="min-w-0 break-words line-clamp-2">{name || placeholder}</span>
      <ChevronDown className={`mt-0.5 shrink-0 ${small ? "h-3.5 w-3.5" : "h-4 w-4"} ${tone}`} aria-hidden />
    </button>
  );
}

function TapeGroup({ title, className = "", children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

/**
 * One comparison line: side A's value, the label, side B's value, and an
 * optional split bar. The better value is bold in its side's colour.
 */
function TapeRow({
  label,
  hint,
  a,
  b,
  display = (v) => String(v),
  better = "high",
  bar = false,
  active = false,
  names,
}: {
  label: string;
  hint?: string;
  a: number | null;
  b: number | null;
  display?: (v: number) => string;
  better?: "high" | "low";
  bar?: boolean;
  /** Highlight the row (the format being viewed). */
  active?: boolean;
  names: [string, string];
}) {
  const comparable = a != null && b != null && a !== b;
  const aBetter = comparable && (better === "high" ? a! > b! : a! < b!);
  const bBetter = comparable && !aBetter;
  const total = (a ?? 0) + (b ?? 0);
  const value = (v: number | null, best: boolean, tone: string, align: string) => (
    <span className={`${align} tabular-nums text-sm sm:text-base ${v == null ? "text-faint font-bold" : best ? `${tone} font-black` : "text-soft font-bold"}`}>
      {v == null ? "—" : display(v)}
    </span>
  );
  return (
    <div
      role="group"
      aria-label={`${label}: ${names[0]} ${a == null ? "none" : display(a)}, ${names[1]} ${b == null ? "none" : display(b)}`}
      className={active ? "-mx-2 rounded-lg bg-muted/60 px-2 py-1" : ""}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3" aria-hidden>
        {value(a, aBetter, SIDE.a.text, "text-left")}
        <span className="text-center text-xs font-bold text-muted-foreground leading-tight">
          {label}
          {hint && <span className="block text-[10px] font-medium text-faint">{hint}</span>}
        </span>
        {value(b, bBetter, SIDE.b.text, "text-right")}
      </div>
      {bar && total > 0 && (
        <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          <div className={`h-full rounded-l-full ${SIDE.a.bg} transition-all duration-700`} style={{ width: `${((a ?? 0) / total) * 100}%` }} />
          <div className={`h-full rounded-r-full ${SIDE.b.bg} transition-all duration-700`} style={{ width: `${((b ?? 0) / total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** A past meeting as a small scoreboard: side A on top, game scores in columns. */
function MeetingCard({ meeting: m, labelOf }: { meeting: ComparisonMeeting; labelOf: (ids: string[]) => string }) {
  const { row } = m;
  const aIds = m.aSide === 1 ? row.side1 : row.side2;
  const bIds = m.aSide === 1 ? row.side2 : row.side1;
  const w = winnerOf(row);
  const aWon = w == null ? null : w === m.aSide;
  const games = gamesFromA(row.score, m.aSide);
  const date = row.date ? dateFormat.format(new Date(row.date)) : null;
  const rawScore = !games.length && row.score ? row.score.replace(/\s*\[.*\]/, "") : null;

  const card = (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 transition-colors group-hover:border-border-strong group-hover:bg-muted/60">
      <div className="mb-2 flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
        {m.discipline && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-black text-foreground">{m.discipline}</span>}
        {row.round && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5">{row.round}</span>}
        <span className="min-w-0 truncate">{row.event ?? "Tournament"}</span>
        {row.matchCode && <span className="hidden shrink-0 sm:inline text-faint">{row.matchCode}</span>}
        {date && <span className="ml-auto shrink-0 pl-2">{date}</span>}
        {row.tournamentId && <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${date ? "" : "ml-auto"}`} aria-hidden />}
      </div>
      <MeetingLine label={labelOf(aIds)} side="a" won={aWon === true} games={games.map((g) => [g.a, g.b])} />
      <MeetingLine label={labelOf(bIds)} side="b" won={aWon === false} games={games.map((g) => [g.b, g.a])} />
      {rawScore && <p className="mt-1 pl-3 text-xs text-muted-foreground">{rawScore}</p>}
      {m.eligibility === "walkover" && (
        <p className="mt-1 pl-3 text-[11px] font-bold text-muted-foreground">Walkover · not counted in the record</p>
      )}
    </div>
  );

  return row.tournamentId ? (
    <Link href={matchPath(row.tournamentId, row.id)} className="group block">
      {card}
    </Link>
  ) : (
    card
  );
}

function MeetingLine({ label, side, won, games }: { label: string; side: SideKey; won: boolean; games: [number, number][] }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={`h-4 w-1 shrink-0 rounded-full ${SIDE[side].bg}`} aria-hidden />
      <span className={`min-w-0 flex-1 break-words text-sm leading-tight ${won ? "font-black text-foreground" : "font-semibold text-muted-foreground"}`}>
        {label}
      </span>
      {won && <Trophy className="h-3.5 w-3.5 shrink-0 text-gold" aria-label="Winner" />}
      {games.length > 0 && (
        <span className="flex shrink-0 tabular-nums">
          {games.map(([mine, theirs], i) => (
            <span
              key={i}
              className={`w-7 text-center text-sm ${mine > theirs ? "font-black text-foreground" : "font-medium text-muted-foreground"}`}
            >
              {mine}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
