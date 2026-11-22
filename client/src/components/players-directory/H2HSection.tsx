import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { playerService } from "@/services/playerService";
import { fetchComparisonRows } from "@/services/comparisonService";
import { Swords, Trophy, Activity, BarChart3, ChevronDown, User, Users } from "lucide-react";
import { Link } from "wouter";
import { BeautifulScoreDisplay } from "@/components/feed/BeautifulScoreDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { calculateRanksMap } from "@/lib/rankingUtils";
import { PlayerSelect } from "@/components/ui/PlayerSelect";
import { winnerOf } from "@/lib/comparison";
import { matchPath } from "@/lib/tournamentRoutes";
import {
  H2H_FORMATS,
  compareByFormat,
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

const SELECT_CLASS =
  "text-sm sm:text-xl font-black text-foreground bg-transparent appearance-none text-center cursor-pointer hover:bg-muted px-2 sm:px-6 py-1 rounded-xl w-full focus:outline-none/90 focus:ring-0 focus:border-0/90 border-0 outline-none pr-8";
const PARTNER_SELECT_CLASS =
  "text-xs sm:text-sm font-bold text-muted-foreground bg-transparent appearance-none text-center cursor-pointer hover:bg-muted px-2 py-1 rounded-xl w-full focus:outline-none/90 focus:ring-0 border-0 outline-none pr-7";

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

  const chooseMode = (next: Mode) => setMode(next);
  const chooseFormat = (next: H2HFormat) => setFormat(next);
  // A pair comparison has one event, so its format follows the pairs.
  const activeFormat: H2HFormat =
    mode === "pairs" ? (pairEvent === "XD" ? "Mixed" : pairEvent ? "Doubles" : "All") : format;
  const formatLabel = mode === "pairs" ? (pairEvent ? PAIR_KIND_LABELS[pairEvent] : "") : format === "All" ? "" : format;

  const sideA = mode === "pairs" ? [p1Id, partner1Id] : [p1Id];
  const sideB = mode === "pairs" ? [p2Id, partner2Id] : [p2Id];
  const pairsIncomplete = mode === "pairs" && (!partner1Id || !partner2Id);
  const pairsClash = mode === "pairs" && !pairsIncomplete && new Set([...sideA, ...sideB]).size < 4;
  const ready = !!p1Id && !!p2Id && p1Id !== p2Id && !pairsIncomplete && !pairsClash;

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

  const nameOf = (id: string | null | undefined) => (id ? byId.get(id)?.full_name ?? "" : "");
  const labelOf = (ids: string[]) => ids.map(nameOf).filter(Boolean).join(" & ");
  const labelA = labelOf(sideA);
  const labelB = labelOf(sideB);
  const inFormat = formatLabel ? ` in ${formatLabel.toLowerCase()}` : "";

  const rivalryMilestone = useMemo(() => {
    if (!p1Id || !p2Id) return null;
    if (pairsIncomplete)
      return { text: "Choose a partner for each player to compare the pairs.", color: "text-muted-foreground" };
    if (pairsClash) return { text: "Pick four different players to compare two pairs.", color: "text-muted-foreground" };
    const total = p1Wins + p2Wins;
    if (total === 0)
      return {
        text: `No matches yet between ${labelA} & ${labelB}${inFormat}. Who will draw first blood?`,
        color: "text-muted-foreground",
      };
    if (total === 1)
      return {
        text: `This rivalry is just getting started! The gauntlet has been thrown.`,
        color: "text-info",
      };
    if (p1Wins === p2Wins)
      return {
        text: `Dead even at ${p1Wins}-${p2Wins}! This rivalry is a toss-up — next match decides the bragging rights.`,
        color: "text-warning",
      };
    const leader = p1Wins > p2Wins ? labelA : labelB;
    const trailer = p1Wins > p2Wins ? labelB : labelA;
    const leaderWins = Math.max(p1Wins, p2Wins);
    const trailerWins = Math.min(p1Wins, p2Wins);
    const gap = leaderWins - trailerWins;
    if (gap === 1)
      return {
        text: `${trailer} ${mode === "pairs" ? "are" : "is"} 1 win away from tying the series! Can they even it up?`,
        color: "text-danger",
      };
    if (gap === 2)
      return {
        text: `${leader} ${mode === "pairs" ? "lead" : "leads"} ${leaderWins}-${trailerWins}. ${trailer} ${mode === "pairs" ? "need" : "needs"} to win 2 straight to level the series.`,
        color: "text-secondary",
      };
    if (leaderWins >= 5 && gap >= 3)
      return {
        text: `${leader} ${mode === "pairs" ? "dominate" : "dominates"} this rivalry ${leaderWins}-${trailerWins}. ${trailer} ${mode === "pairs" ? "are" : "is"} in desperate need of a comeback!`,
        color: "text-danger",
      };
    return {
      text: `${leader} ${mode === "pairs" ? "lead" : "leads"} ${leaderWins}-${trailerWins}. ${trailer} ${mode === "pairs" ? "have" : "has"} some ground to make up!`,
      color: "text-muted-foreground",
    };
  }, [p1Id, p2Id, pairsIncomplete, pairsClash, p1Wins, p2Wins, labelA, labelB, inFormat, mode]);

  // Rating for this format (a pair's is the mean of its two players).
  const p1WinProb = winChancePct(
    sideRating(sideA.map((id) => byId.get(id)), activeFormat),
    sideRating(sideB.map((id) => byId.get(id)), activeFormat),
  );
  const p2WinProb = 100 - p1WinProb;

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Activity className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  const fullPageHref = `/h2h?a=${sideA.join(",")}&b=${sideB.join(",")}${mode === "pairs" ? "&mode=pairs" : ""}`;

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
                onClick={() => chooseMode(m)}
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
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Format">
          {H2H_FORMATS.map((f) => {
            const r = byFormat?.[f];
            const active = format === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                onClick={() => chooseFormat(f)}
                className={`min-h-[44px] px-3 rounded-xl text-sm font-bold border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "border-border-strong text-muted-foreground hover:text-foreground"}`}
              >
                {f}
                <span className={`ml-1.5 text-xs font-black ${active ? "" : "text-soft"}`}>
                  {r && r.sample > 0 ? `${r.aWins}–${r.bWins}` : "—"}
                </span>
              </button>
            );
          })}
        </div>
        )}

        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <SidePicker
              playerId={p1Id}
              onPlayer={setP1Id}
              partnerId={partner1Id}
              onPartner={setPartner1Id}
              pairs={mode === "pairs"}
              players={players}
              partners={leftPartnerOptions}
              byId={byId}
              ranks={rankMap[p1Id]}
              accent="text-primary"
              placeholder="Player 1"
            />

            <div className="flex flex-col items-center w-full px-2">
              {ready && comparison.isLoading ? (
                <Activity className="w-7 h-7 animate-spin text-primary my-2" aria-label="Loading matches" />
              ) : (
                <div className="text-3xl sm:text-4xl font-black text-foreground mb-1">
                  {p1Wins}{" "}
                  <span className="text-muted-foreground">-</span>{" "}
                  {p2Wins}
                </div>
              )}
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                {totalMatchesPlayed} {totalMatchesPlayed === 1 ? "Match" : "Matches"}
                {formatLabel && ` · ${formatLabel}`}
              </div>
              {walkoverCount > 0 && (
                <div className="text-[10px] font-bold text-muted-foreground mb-2">
                  + {walkoverCount} walkover{walkoverCount === 1 ? "" : "s"}, not counted
                </div>
              )}
              {comparison.isError && (
                <div className="text-[10px] font-bold text-danger mb-2">Couldn't load matches. Try again later.</div>
              )}

              {/* Deeper analysis: charts for two players, the full page for pairs */}
              {ready && (
                <Link href={mode === "players" ? `/compare/${p1Id}/${p2Id}` : fullPageHref}>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-[10px] font-black uppercase tracking-wider my-3 hover:scale-105 transition-transform shadow-md">
                    <BarChart3 className="w-3.5 h-3.5" /> {mode === "players" ? "Analytics" : "Full comparison"}
                  </button>
                </Link>
              )}

              {/* H2H wins visual bar */}
              {totalMatchesPlayed > 0 && (
                <div className="w-full mb-3" aria-label={`Head to head wins: ${labelA} ${p1Wins} vs ${labelB} ${p2Wins}`}>
                  <div className="flex h-3 rounded-full overflow-hidden w-full shadow-inner bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-1000 ease-out"
                      style={{ width: `${(p1Wins / totalMatchesPlayed) * 100}%` }}
                    />
                    <div
                      className="h-full bg-info transition-all duration-1000 ease-out"
                      style={{ width: `${(p2Wins / totalMatchesPlayed) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold mt-1 px-0.5">
                    <span className="text-primary">{p1Wins} W</span>
                    <span className="text-info">{p2Wins} W</span>
                  </div>
                </div>
              )}

              {/* Points Scored & Streaks Breakdown */}
              {(pointStats.aPoints > 0 || pointStats.bPoints > 0) && (
                <div className="w-full mb-3 p-2 bg-muted/40 rounded-xl border border-border-strong/40 space-y-1.5">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    <span>Pts</span>
                    <span className="text-soft font-bold">{pointStats.aPoints} - {pointStats.bPoints}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden flex bg-muted-strong">
                    <div
                      className="h-full bg-success transition-all duration-700"
                      style={{ width: `${(pointStats.aPoints / (pointStats.aPoints + pointStats.bPoints || 1)) * 100}%` }}
                    />
                    <div
                      className="h-full bg-individual transition-all duration-700"
                      style={{ width: `${(pointStats.bPoints / (pointStats.aPoints + pointStats.bPoints || 1)) * 100}%` }}
                    />
                  </div>
                  {(pointStats.aBestRun > 1 || pointStats.bBestRun > 1) && (
                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground pt-1 border-t border-border-strong/50">
                      <span className="text-success">Streak: {pointStats.aBestRun}</span>
                      <span className="text-individual">Streak: {pointStats.bBestRun}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Rivalry Milestone */}
              {rivalryMilestone && (
                <div className="w-full mb-2 text-center px-1">
                  <p className={`text-[10px] sm:text-xs font-bold italic leading-snug ${rivalryMilestone.color}`}>
                    {rivalryMilestone.text}
                  </p>
                </div>
              )}

              {/* Win Probability Predictor */}
              <div className="w-full bg-muted/50 p-2.5 rounded-xl border border-border-strong/50">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-center mb-1.5 flex items-center justify-center gap-1">
                  <Activity className="w-3 h-3 text-info" /> Win Prob{formatLabel && ` · ${formatLabel}`}
                </div>
                <div className="flex justify-between text-[10px] font-bold mb-1 px-1">
                  <span className="text-primary">{p1WinProb}%</span>
                  <span className="text-info">{p2WinProb}%</span>
                </div>
                <div className="h-2 w-full bg-info/20 rounded-full overflow-hidden flex">
                  <div className="h-full bg-primary transition-all duration-1000 ease-out" style={{ width: `${p1WinProb}%` }} />
                  <div className="h-full bg-info transition-all duration-1000 ease-out" style={{ width: `${p2WinProb}%` }} />
                </div>
              </div>
            </div>

            <SidePicker
              playerId={p2Id}
              onPlayer={setP2Id}
              partnerId={partner2Id}
              onPartner={setPartner2Id}
              pairs={mode === "pairs"}
              players={rightPlayerOptions}
              partners={rightPartnerOptions}
              byId={byId}
              ranks={rankMap[p2Id]}
              accent="text-info"
              placeholder="Player 2"
            />
          </div>
        </div>

        {history.length > 0 && (
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2 w-full">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                Match History{formatLabel && ` · ${formatLabel}`}
              </h3>
            </div>

            {history.map((m) => {
              const { row } = m;
              const team1Won = winnerOf(row) === 1;
              const card = (
                <div className="group relative overflow-hidden rounded-xl border border-warning/35 bg-warning/10 shadow-sm transition-all duration-200 mb-2 hover:border-warning/60">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 pt-2.5 pb-1 gap-1 sm:gap-2">
                    <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                      <span className="flex items-center gap-1.5">
                        {m.discipline && (
                          <span className="text-[10px] bg-muted text-foreground px-1.5 py-0.5 rounded font-black">{m.discipline}</span>
                        )}
                        {row.round && (
                          <span className="text-[10px] bg-warning/15 text-warning px-2 py-0.5 rounded font-bold">{row.round}</span>
                        )}
                        {m.eligibility === "walkover" && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-bold">Walkover</span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground mt-0.5 mr-2 sm:hidden">{row.matchCode}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs font-black text-warning uppercase tracking-widest line-clamp-1 mt-1 sm:mt-0 sm:flex-1 sm:text-center">
                      {row.event ?? "Tournament"}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground hidden sm:block whitespace-nowrap">{row.matchCode}</span>
                  </div>

                  {/* Teams */}
                  <div className="px-3 pb-2.5 pt-1">
                    <div className="relative flex flex-col">
                      <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 sm:justify-center ${team1Won ? "bg-primary/10" : ""}`}>
                        {team1Won ? <Trophy className="w-3.5 h-3.5 text-gold shrink-0" /> : <div className="w-3.5 h-3.5 shrink-0" />}
                        <span className={`flex-1 text-xs sm:text-sm font-bold leading-tight sm:flex-none sm:text-center ${team1Won ? "text-primary" : "text-soft"}`}>
                          {labelOf(row.side1)}
                        </span>
                        <div className="w-3.5 h-3.5 shrink-0 hidden sm:block opacity-0" />
                      </div>

                      <div className="flex items-center justify-center gap-3 py-1">
                        <div className="flex-1 h-px bg-muted-strong/50" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-danger">vs</span>
                        <div className="flex-1 h-px bg-muted-strong/50" />
                      </div>

                      <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 sm:justify-center ${!team1Won ? "bg-primary/10" : ""}`}>
                        {!team1Won ? <Trophy className="w-3.5 h-3.5 text-gold shrink-0" /> : <div className="w-3.5 h-3.5 shrink-0" />}
                        <span className={`flex-1 text-xs sm:text-sm font-bold leading-tight sm:flex-none sm:text-center ${!team1Won ? "text-primary" : "text-soft"}`}>
                          {labelOf(row.side2)}
                        </span>
                        <div className="w-3.5 h-3.5 shrink-0 hidden sm:block opacity-0" />
                      </div>
                    </div>

                    {row.score && (
                      <div className="mt-1.5 flex flex-wrap gap-1 border-t border-warning/30 pt-2 pl-2 sm:justify-center sm:pl-0">
                        <BeautifulScoreDisplay score={row.score} />
                      </div>
                    )}
                  </div>
                </div>
              );
              return row.tournamentId ? (
                <Link key={row.id} href={matchPath(row.tournamentId, row.id)} className="block">
                  {card}
                </Link>
              ) : (
                <div key={row.id}>{card}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** One side: avatar(s), the player picker, a partner picker for pairs, and rank chips. */
function SidePicker({
  playerId,
  onPlayer,
  partnerId,
  onPartner,
  pairs,
  players,
  partners,
  byId,
  ranks,
  accent,
  placeholder,
}: {
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
  ranks: Ranks | undefined;
  accent: "text-primary" | "text-info";
  placeholder: string;
}) {
  const player = byId.get(playerId);
  const partner = partnerId ? byId.get(partnerId) : null;
  const avatarSize = pairs ? "w-16 h-16 sm:w-20 sm:h-20" : "w-20 h-20 sm:w-24 sm:h-24";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`flex ${pairs ? "-space-x-4" : ""}`}>
        <div className={`${avatarSize} rounded-full overflow-hidden border-4 border-border shadow-lg bg-muted`}>
          {player?.avatar_url && <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />}
        </div>
        {pairs && (
          <div className={`${avatarSize} rounded-full overflow-hidden border-4 border-border shadow-lg bg-muted`}>
            {partner?.avatar_url && <img src={partner.avatar_url} alt="" className="w-full h-full object-cover" />}
          </div>
        )}
      </div>
      <div className="relative group w-full px-1 mx-auto">
        <PlayerSelect value={playerId} onChange={onPlayer} players={players} placeholder={placeholder} className={SELECT_CLASS} />
        <div className={`absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none ${accent}`}>
          <ChevronDown className="w-4 h-4 drop-shadow-sm" />
        </div>
      </div>
      {pairs && (
        <div className="relative group w-full px-1 mx-auto -mt-2">
          <span className="block text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground">& partner</span>
          <PlayerSelect value={partnerId} onChange={onPartner} players={partners} placeholder="Choose partner" className={PARTNER_SELECT_CLASS} />
          <div className={`absolute bottom-2 right-2 pointer-events-none ${accent}`}>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      )}
      <div className="flex gap-1.5 flex-row flex-wrap justify-center text-[10px] font-black mt-1 mx-auto min-h-[24px] w-full">
        {!!ranks?.overall && (
          <span className="px-2 py-1 bg-warning/10 text-warning rounded-md border border-warning/30">OVR: #{ranks.overall}</span>
        )}
        {!!ranks?.singles && (
          <span className="px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">S: #{ranks.singles}</span>
        )}
        {!!ranks?.doubles && (
          <span className="px-2 py-1 bg-info/10 text-info rounded-md border border-info/30">D: #{ranks.doubles}</span>
        )}
        {!!ranks?.mixed && (
          <span className="px-2 py-1 bg-individual/10 text-individual rounded-md border border-individual/30">XD: #{ranks.mixed}</span>
        )}
      </div>
    </div>
  );
}
