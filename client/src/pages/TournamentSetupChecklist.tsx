import React from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TournamentSetupChecklist() {
  const [, params] = useRoute('/tournament-setup/:id');
  const tournamentId = params?.id;
  const [, navigate] = useLocation();

  usePageMeta({ 
    title: "Tournament Launch Checklist", 
    description: "Guided next steps for your badminton tournament" 
  });

  const { data: tournament, isLoading } = useQuery({
    queryKey: ['tournament_setup_checklist', tournamentId],
    queryFn: async () => {
      if (!tournamentId) throw new Error("No tournament id");
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tournamentId
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['setup_teams', tournamentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tournament_teams' as any)
        .select('*')
        .eq('tournament_id', tournamentId);
      return data || [];
    },
    enabled: !!tournamentId
  });

  const { data: ties = [] } = useQuery({
    queryKey: ['setup_ties', tournamentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tournament_ties' as any)
        .select('*')
        .eq('tournament_id', tournamentId);
      return data || [];
    },
    enabled: !!tournamentId
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['setup_matches', tournamentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tournament_matches' as any)
        .select('*')
        .eq('tournament_id', tournamentId);
      return data || [];
    },
    enabled: !!tournamentId
  });

  const isTeam = tournament?.format_family === 'TEAM' || tournament?.tournament_type === 'team';

  // Checklist items completion state
  const stepDatesConfigured = !!tournament?.start_date;
  const stepTeamsAdded = teams.length > 0 || matches.length > 0;
  const stepFixturesGenerated = isTeam ? ties.length > 0 : matches.length > 0;
  const stepCourtsScheduled = matches.some((m: any) => m.court && m.scheduled_at);
  const stepPublishedLive = tournament?.status === 'active';

  const steps = isTeam ? [
    {
      title: "Set Tournament Dates & Venue",
      desc: "Ensure start date, end date, and court location are accurately listed for players.",
      done: stepDatesConfigured,
      actionText: "Configure in Admin",
      actionUrl: `/tournament-admin?id=${tournamentId}&tab=settings`
    },
    {
      title: "Add / Import Teams & Captains",
      desc: `Registered teams: ${teams.length}. Captains can manage secret lineups once teams are created.`,
      done: stepTeamsAdded,
      actionText: "Manage Teams",
      actionUrl: `/tournament-admin?id=${tournamentId}&tab=teams`
    },
    {
      title: "Generate Match Fixtures & Ties",
      desc: `Created ties: ${ties.length}. Round-robin groups or knockout fixtures.`,
      done: stepFixturesGenerated,
      actionText: "Generate Fixtures",
      actionUrl: `/tournament-admin?id=${tournamentId}&tab=fixtures`
    },
    {
      title: "Assign Match Times & Courts",
      desc: "Assign court numbers and scheduled times for umpires and scoreboards.",
      done: stepCourtsScheduled,
      actionText: "Schedule Matches",
      actionUrl: `/pulse?id=${tournamentId}&subtab=schedule#live`
    },
    {
      title: "Publish Live to Players & Spectators",
      desc: "Switch tournament status from 'draft' to 'active' so it appears on Pulse Live.",
      done: stepPublishedLive,
      actionText: "Go Live",
      actionUrl: `/tournament-admin?id=${tournamentId}&tab=settings`
    }
  ] : [
    {
      title: "Set Tournament Dates & Venue",
      desc: "Ensure start date, end date, and court location are accurately set.",
      done: stepDatesConfigured,
      actionText: "Configure in Admin",
      actionUrl: `/tournament-admin?id=${tournamentId}&tab=settings`
    },
    {
      title: "Import Registered Entrants",
      desc: "Upload CSV or add participants to Singles / Doubles / Mixed draws.",
      done: stepTeamsAdded,
      actionText: "Manage Entrants",
      actionUrl: `/tournament-admin?id=${tournamentId}&tab=participants`
    },
    {
      title: "Generate Knockout Brackets",
      desc: "Generate seeded single-elimination draw brackets for all categories.",
      done: stepFixturesGenerated,
      actionText: "Generate Draw",
      actionUrl: `/tournament-admin?id=${tournamentId}&tab=brackets`
    },
    {
      title: "Assign Court Numbers & Times",
      desc: "Schedule initial rounds onto courts for umpire tablet scoring.",
      done: stepCourtsScheduled,
      actionText: "Schedule Courts",
      actionUrl: `/pulse?id=${tournamentId}&subtab=schedule#live`
    },
    {
      title: "Publish Live to Club",
      desc: "Mark tournament active to publish draws and live scoreboards.",
      done: stepPublishedLive,
      actionText: "Go Live",
      actionUrl: `/tournament-admin?id=${tournamentId}&tab=settings`
    }
  ];

  const completedCount = steps.filter(s => s.done).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Success Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Tournament Created Successfully
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {tournament?.name || 'New Tournament'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {isTeam ? 'Team Tournament' : 'Open Knockout Tournament'} · {tournament?.venue || 'Campus Badminton Courts'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1 shrink-0">
              <span className="text-xs font-bold text-slate-400">Launch Readiness</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${(completedCount / steps.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-primary">{completedCount}/{steps.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Guided Steps Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Launch Checklist &amp; Next Steps
            </h2>
            <p className="text-xs text-slate-500">
              Follow these recommended steps to prepare the tournament for players and umpires
            </p>
          </div>

          <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
            {steps.map((st, i) => (
              <div key={i} className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {st.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold flex items-center gap-2 ${st.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      <span>Step {i + 1}: {st.title}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{st.desc}</p>
                  </div>
                </div>

                <Link href={st.actionUrl}>
                  <Button 
                    size="sm" 
                    variant={st.done ? "outline" : "default"}
                    className="text-xs font-bold shrink-0 self-start sm:self-center"
                  >
                    {st.actionText}
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Fast Links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Link href={`/pulse?id=${tournamentId}#live`}>
            <Button variant="outline" className="w-full sm:w-auto text-xs font-bold">
              View on Pulse Live
            </Button>
          </Link>
          <Link href={`/tournament-admin?id=${tournamentId}`}>
            <Button className="w-full sm:w-auto text-xs font-bold bg-primary text-slate-950 hover:bg-primary/90">
              Open Tournament Admin Panel
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
