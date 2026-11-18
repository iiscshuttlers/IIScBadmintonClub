import { tournamentPath } from "@/lib/tournamentRoutes";
import React from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { teamService } from '@/services/teamService';
import { usePageMeta } from '@/hooks/usePageMeta';
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Calendar, 
  Users, 
  Swords, 
  MapPin, 
  ShieldCheck, 
  Trophy, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Megaphone,
  Layers,
  PlayCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  fetchAllTournamentMatchRows,
  fetchTournamentById,
  fetchTournamentParticipants,
} from '@/services/tournamentService';
import { 
  evaluateLifecycleReadiness, 
  type LifecycleAction, 
  type ReadinessIssue 
} from '@/lib/tournamentReadiness';

export default function TournamentSetupChecklist() {
  const [, params] = useRoute<{ id: string }>('/tournament-setup/:id');
  const tournamentId = params?.id;
  const [, navigate] = useLocation();

  usePageMeta({ 
    title: "Tournament Launch Checklist", 
    description: "Guided lifecycle readiness for announcing, publishing draws, and live play" 
  });

  const { data: tournament, isLoading, isError: tournamentError } = useQuery({
    queryKey: ['tournament_setup_checklist', tournamentId],
    queryFn: async () => {
      if (!tournamentId) throw new Error("No tournament id");
      return fetchTournamentById(tournamentId);
    },
    enabled: !!tournamentId
  });

  const teamsQuery = useQuery({
    queryKey: ['setup_teams', tournamentId],
    queryFn: async () => {
      return teamService.getTournamentTeamRows(tournamentId);
    },
    enabled: !!tournamentId
  });

  const tiesQuery = useQuery({
    queryKey: ['setup_ties', tournamentId],
    queryFn: async () => {
      return teamService.getTournamentTieRows(tournamentId);
    },
    enabled: !!tournamentId
  });

  const matchesQuery = useQuery({
    queryKey: ['setup_matches', tournamentId],
    queryFn: async () => {
      return fetchAllTournamentMatchRows(tournamentId);
    },
    enabled: !!tournamentId
  });

  const participantsQuery = useQuery({
    queryKey: ['setup_participants', tournamentId],
    queryFn: () => fetchTournamentParticipants(tournamentId!),
    enabled: !!tournamentId,
  });

  const teams = teamsQuery.data ?? [];
  const ties = tiesQuery.data ?? [];
  const matches = (matchesQuery.data ?? []) as any[];
  const participants = participantsQuery.data ?? [];

  const isTeam = tournament?.format_family === 'TEAM' || tournament?.tournament_type === 'team';
  const dataError = tournamentError || [teamsQuery, tiesQuery, matchesQuery, participantsQuery].some((query) => query.isError);

  const announceReport = evaluateLifecycleReadiness({
    action: "announce",
    tournament,
    participants,
    teamCount: teams.length,
    tieCount: ties.length,
    matches,
    dataError,
  });

  const publishDrawReport = evaluateLifecycleReadiness({
    action: "publish_draw",
    tournament,
    participants,
    teamCount: teams.length,
    tieCount: ties.length,
    matches,
    dataError,
  });

  const startPlayReport = evaluateLifecycleReadiness({
    action: "start_play",
    tournament,
    participants,
    teamCount: teams.length,
    tieCount: ties.length,
    matches,
    dataError,
  });

  // Checklist items structured across the 3 stages
  const stage1Items = [
    {
      title: 'Tournament Name, Date & Venue',
      desc: tournament?.name && tournament?.start_date && tournament?.venue
        ? `${tournament.name} · ${tournament.venue}`
        : 'Configure event name, start date, and venue location',
      done: !!(tournament?.name && tournament?.start_date && tournament?.venue),
      blocking: true,
      tab: 'setup',
      actionText: 'Configure',
    },
    {
      title: 'Description & Format Details',
      desc: tournament?.description?.trim()
        ? 'Public description and rules summary provided'
        : 'Add an event description or eligibility guidelines',
      done: !!tournament?.description?.trim(),
      blocking: false,
      tab: 'setup',
      actionText: 'Edit Details',
    },
    {
      title: isTeam ? 'Team Format & Tie Config' : 'Playing Categories',
      desc: isTeam 
        ? 'Team tie rubbers and scoring configurations'
        : (tournament?.categories?.length ? `${tournament.categories.join(', ')} categories enabled` : 'Select competition categories (MS, WS, MD, WD, XD)'),
      done: isTeam ? true : !!(tournament?.categories && tournament.categories.length > 0),
      blocking: false,
      tab: 'setup',
      actionText: 'Review Categories',
    },
  ];

  const stage2Items = [
    {
      title: isTeam ? 'Registered Teams & Rosters' : 'Participants & Entries',
      desc: isTeam
        ? `${teams.length} team(s) configured`
        : `${participants.length} player(s) registered`,
      done: isTeam ? teams.length > 0 : participants.length > 0,
      blocking: true,
      tab: isTeam ? 'teams' : 'participants',
      actionText: isTeam ? 'Manage Teams' : 'Manage Participants',
    },
    ...(!isTeam ? [{
      title: 'Doubles & Mixed Pair Assignments',
      desc: (() => {
        const unresolved = participants.filter(p => 
          ["MD", "WD", "XD", "DOUBLES", "MIXED"].some(cat => (p.category ?? "").toUpperCase().includes(cat)) &&
          !p.partner_id && !(p.display_name ?? "").includes("&")
        );
        return unresolved.length === 0
          ? 'All doubles and mixed entries have partners resolved'
          : `${unresolved.length} pair(s) missing partner assignments`;
      })(),
      done: participants.filter(p => 
        ["MD", "WD", "XD", "DOUBLES", "MIXED"].some(cat => (p.category ?? "").toUpperCase().includes(cat)) &&
        !p.partner_id && !(p.display_name ?? "").includes("&")
      ).length === 0,
      blocking: true,
      tab: 'participants',
      actionText: 'Resolve Pairs',
    }] : []),
    {
      title: isTeam ? 'Tournament Ties & Fixtures' : 'Draws & Bracket Fixtures',
      desc: isTeam 
        ? `${ties.length} tie(s) generated`
        : `${matches.length} bracket match(es) generated`,
      done: isTeam ? ties.length > 0 : matches.length > 0,
      blocking: true,
      tab: isTeam ? 'fixtures' : 'bracket',
      actionText: isTeam ? 'Generate Ties' : 'Open Bracket',
    },
    {
      title: 'Scoring Rules & Formats',
      desc: (() => {
        const invalid = matches.filter(m => (m.points_to_win ?? 0) <= 0 || (m.best_of_sets ?? 0) <= 0 || (m.best_of_sets ?? 0) % 2 === 0);
        return matches.length > 0 && invalid.length === 0
          ? `All ${matches.length} match(es) have valid scoring rules`
          : invalid.length > 0
          ? `${invalid.length} match(es) have invalid scoring rules`
          : 'Generate fixtures to configure scoring rules';
      })(),
      done: matches.length > 0 && matches.every(m => (m.points_to_win ?? 0) > 0 && (m.best_of_sets ?? 0) > 0 && (m.best_of_sets ?? 0) % 2 === 1),
      blocking: true,
      tab: 'rules',
      actionText: 'Configure Scoring',
    },
  ];

  const stage3Items = [
    {
      title: 'Playable Matches Populated',
      desc: (() => {
        const playable = matches.filter(m => (m.player1_id || m.team1_label) && (m.player2_id || m.team2_label) && !["completed", "walkover", "cancelled"].includes(m.status ?? ""));
        return playable.length > 0
          ? `${playable.length} playable match(es) ready`
          : 'Assign competitors to both sides of at least one match';
      })(),
      done: matches.some(m => (m.player1_id || m.team1_label) && (m.player2_id || m.team2_label) && !["completed", "walkover", "cancelled"].includes(m.status ?? "")),
      blocking: true,
      tab: 'bracket',
      actionText: 'Review Bracket',
    },
    {
      title: 'Round 1 Court & Schedule Assignments',
      desc: (() => {
        const playable = matches.filter(m => (m.player1_id || m.team1_label) && (m.player2_id || m.team2_label) && !["completed", "walkover", "cancelled"].includes(m.status ?? ""));
        const unscheduled = playable.filter(m => !m.court_number?.trim() || !m.scheduled_at);
        return playable.length > 0 && unscheduled.length === 0
          ? `All ${playable.length} playable match(es) scheduled with court and time`
          : `${unscheduled.length} playable match(es) need court & time`;
      })(),
      done: matches.filter(m => (m.player1_id || m.team1_label) && (m.player2_id || m.team2_label) && !["completed", "walkover", "cancelled"].includes(m.status ?? "")).length > 0 &&
            matches.filter(m => (m.player1_id || m.team1_label) && (m.player2_id || m.team2_label) && !["completed", "walkover", "cancelled"].includes(m.status ?? "")).every(m => !!m.court_number?.trim() && !!m.scheduled_at),
      blocking: true,
      tab: 'schedule',
      actionText: 'Open Schedule',
    },
    {
      title: 'Court Blackout Conflicts Clearance',
      desc: startPlayReport.blockers.some(b => b.code === 'HARD_SCHEDULE_CONFLICT')
        ? 'Matches overlap unavailable court periods'
        : 'No scheduled matches conflict with court blackout hours',
      done: !startPlayReport.blockers.some(b => b.code === 'HARD_SCHEDULE_CONFLICT'),
      blocking: true,
      tab: 'schedule',
      actionText: 'Resolve Overlaps',
    },
    {
      title: 'Match Officials & Umpires Assignment',
      desc: (() => {
        const playable = matches.filter(m => (m.player1_id || m.team1_label) && (m.player2_id || m.team2_label) && !["completed", "walkover", "cancelled"].includes(m.status ?? ""));
        const unassigned = playable.filter(m => !m.umpired_by);
        return playable.length > 0 && unassigned.length === 0
          ? `All ${playable.length} playable match(es) assigned to officials`
          : `${unassigned.length} playable match(es) unassigned (optional for club play)`;
      })(),
      done: matches.filter(m => (m.player1_id || m.team1_label) && (m.player2_id || m.team2_label) && !["completed", "walkover", "cancelled"].includes(m.status ?? "")).length > 0 &&
            matches.filter(m => (m.player1_id || m.team1_label) && (m.player2_id || m.team2_label) && !["completed", "walkover", "cancelled"].includes(m.status ?? "")).every(m => !!m.umpired_by),
      blocking: false,
      tab: 'officials',
      actionText: 'Manage Officials',
    },
  ];

  const totalItems = [...stage1Items, ...stage2Items, ...stage3Items];
  const totalVerified = totalItems.filter(i => i.done).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      <PageHeader
        backTo={`/tournament-admin?id=${tournamentId}`}
        backLabel="Tournament Manager"
        badge="Launch checklist"
        badgeIcon={<Sparkles className="w-3.5 h-3.5 text-primary" />}
        title={tournament?.name || 'Tournament Launch Checklist'}
        subtitle={`${isTeam ? 'Team Tournament' : 'Open Knockout Tournament'} · ${tournament?.venue || 'Campus Badminton Courts'} · Status: ${tournament?.status ?? 'draft'}`}
        action={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-400">Total Progress:</span>
            <span className="text-xs font-mono font-bold text-primary">{totalVerified}/{totalItems.length}</span>
          </div>
        }
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {dataError && (
          <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Some tournament readiness data could not be loaded. Please refresh before publishing or starting play.</span>
          </div>
        )}

        {/* Section 1: Announce Stage */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${announceReport.allowed ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'}`}>
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Stage 1: Announce Event &amp; Registration</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Publish dates, venue, rules, and open player registrations
                </p>
              </div>
            </div>
            <div className="shrink-0">
              {announceReport.allowed ? (
                <span className="px-2.5 py-1 text-xs font-black rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  Ready to Announce
                </span>
              ) : (
                <span className="px-2.5 py-1 text-xs font-black rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                  {announceReport.blockers.length} Blocker(s)
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
            {stage1Items.map((item, idx) => (
              <div key={idx} className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {item.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className={`w-5 h-5 ${item.blocking ? 'text-rose-400' : 'text-slate-300 dark:text-slate-500'}`} />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${item.done ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>

                <Link href={`/tournament-admin?id=${tournamentId}&tab=${item.tab}`}>
                  <Button 
                    size="sm" 
                    variant={item.done ? "outline" : "default"}
                    className="text-xs font-bold shrink-0 self-start sm:self-center"
                  >
                    {item.actionText}
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Publish Draw Stage */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${publishDrawReport.allowed ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'}`}>
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Stage 2: Publish Draw &amp; Fixtures</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Safely release brackets, resolved participant pairs, and scoring rules to players
                </p>
              </div>
            </div>
            <div className="shrink-0">
              {publishDrawReport.allowed ? (
                <span className="px-2.5 py-1 text-xs font-black rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  Ready to Publish
                </span>
              ) : (
                <span className="px-2.5 py-1 text-xs font-black rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                  {publishDrawReport.blockers.length} Blocker(s)
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
            {stage2Items.map((item, idx) => (
              <div key={idx} className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {item.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className={`w-5 h-5 ${item.blocking ? 'text-rose-400' : 'text-slate-300 dark:text-slate-500'}`} />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${item.done ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>

                <Link href={`/tournament-admin?id=${tournamentId}&tab=${item.tab}`}>
                  <Button 
                    size="sm" 
                    variant={item.done ? "outline" : "default"}
                    className="text-xs font-bold shrink-0 self-start sm:self-center"
                  >
                    {item.actionText}
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Start Play Stage */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${startPlayReport.allowed ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'}`}>
                <PlayCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Stage 3: Start Live Tournament Play</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Open live courts, umpire scoring screens, court callouts, and live feeds
                </p>
              </div>
            </div>
            <div className="shrink-0">
              {tournament?.status === 'active' ? (
                <span className="px-2.5 py-1 text-xs font-black rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  Live &amp; Active
                </span>
              ) : startPlayReport.allowed ? (
                <span className="px-2.5 py-1 text-xs font-black rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  Ready for Play
                </span>
              ) : (
                <span className="px-2.5 py-1 text-xs font-black rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                  {startPlayReport.blockers.length} Blocker(s)
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
            {stage3Items.map((item, idx) => (
              <div key={idx} className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {item.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className={`w-5 h-5 ${item.blocking ? 'text-rose-400' : 'text-slate-300 dark:text-slate-500'}`} />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${item.done ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>

                <Link href={`/tournament-admin?id=${tournamentId}&tab=${item.tab}`}>
                  <Button 
                    size="sm" 
                    variant={item.done ? "outline" : "default"}
                    className="text-xs font-bold shrink-0 self-start sm:self-center"
                  >
                    {item.actionText}
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Fast Links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Link href={tournamentPath(tournamentId, "live")}>
            <Button variant="outline" className="w-full sm:w-auto text-xs font-bold">
              View on Pulse Live
            </Button>
          </Link>
          <Link href={`/tournament-admin?id=${tournamentId}&tab=setup`}>
            <Button className="w-full sm:w-auto text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90">
              Open Tournament Admin Panel
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
