import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchFeederMatches, fetchTournamentRefereeRows } from "@/services/tournamentService";
import { playerService } from "@/services/playerService";
import { DISCIPLINE_LABELS, courtLabel, type MatchView } from "@/lib/matchView";
import { matchPath, tournamentPath } from "@/lib/tournamentRoutes";
import { MatchTimes } from "@/components/match/MatchPrimitives";

/**
 * Match facts (cricinfo "Match info"): event, round, code, court, times,
 * bracket links and officials. Officials' names only — never contact details
 * (owner decision, 14 Nov 2026).
 */

export interface MatchOfficialIds {
  umpiredBy: string | null;
  scoredBy: string | null;
}

interface FeedMatch {
  id: string;
  round_name: string | null;
  team1_label: string | null;
  team2_label: string | null;
}

function useMatchInfo(view: MatchView, officials: MatchOfficialIds) {
  return useQuery({
    queryKey: ["tournament_matches", view.tournamentId, "match-info", view.id, officials.umpiredBy, officials.scoredBy],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const umpireId = officials.umpiredBy ?? officials.scoredBy;
      const [feeds, refs] = await Promise.all([
        view.matchCode
          ? fetchFeederMatches(view.tournamentId, view.matchCode)
          : Promise.resolve([] as FeedMatch[]),
        // Readable by signed-in users only (RLS); visitors simply see no referee row.
        fetchTournamentRefereeRows(view.tournamentId),
      ]);
      const refereeIds = ((refs ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
      const ids = Array.from(new Set([umpireId, ...refereeIds].filter((x): x is string => !!x)));
      const names: Record<string, string> = {};
      if (ids.length) {
        // Name only: never select contact columns for public display.
        const data = await playerService.getPlayerNamesByIds(ids);
        for (const p of (data ?? []) as Array<{ id: string; full_name: string | null }>) names[p.id] = p.full_name ?? "";
      }
      return {
        feeds: ((feeds ?? []) as FeedMatch[]).map((f) => ({ ...f })),
        umpire: umpireId ? names[umpireId] || null : null,
        referees: refereeIds.map((id) => names[id]).filter(Boolean),
      };
    },
  });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2">
      <dt className="text-xs font-black uppercase tracking-wider text-muted-foreground pt-0.5">{label}</dt>
      <dd className="text-sm min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function MatchInfoTab({
  view,
  tournament,
  next,
  officials,
}: {
  view: MatchView;
  tournament: { id: string; name: string };
  next: { id: string; round_name: string } | null;
  officials: MatchOfficialIds;
}) {
  const info = useMatchInfo(view, officials);
  const event = view.discipline ? `${view.discipline} · ${DISCIPLINE_LABELS[view.discipline]}` : view.categoryLabel;
  return (
    <dl className="mt-4 divide-y divide-border">
      <Row label="Tournament">
        <Link href={tournamentPath(tournament.id)} className="font-semibold text-primary underline underline-offset-2">
          {tournament.name}
        </Link>
      </Row>
      <Row label="Event">{event || "—"}</Row>
      {view.roundName && <Row label="Round">{view.roundName}</Row>}
      {view.rubberLabel && <Row label="Rubber">{view.rubberLabel}</Row>}
      {view.matchCode && <Row label="Match code"><span className="font-mono">{view.matchCode}</span></Row>}
      <Row label="Court">{view.court ? courtLabel(view.court) : "Not assigned"}</Row>
      <Row label="Times">
        <MatchTimes view={view} />
      </Row>
      {info.data && info.data.feeds.length > 0 && (
        <Row label="Feeds from">
          <ul className="space-y-1">
            {info.data.feeds.map((f) => (
              <li key={f.id}>
                <Link href={matchPath(view.tournamentId, f.id)} className="text-primary underline underline-offset-2">
                  {f.round_name ?? "Earlier round"}: {f.team1_label || "TBD"} vs {f.team2_label || "TBD"}
                </Link>
              </li>
            ))}
          </ul>
        </Row>
      )}
      {next && (
        <Row label="Winner plays">
          <Link href={matchPath(view.tournamentId, next.id)} className="text-primary underline underline-offset-2">
            {next.round_name}
          </Link>
        </Row>
      )}
      {info.data?.umpire && <Row label="Umpire">{info.data.umpire}</Row>}
      {info.data && info.data.referees.length > 0 && (
        <Row label={info.data.referees.length === 1 ? "Referee" : "Referees"}>{info.data.referees.join(", ")}</Row>
      )}
    </dl>
  );
}
