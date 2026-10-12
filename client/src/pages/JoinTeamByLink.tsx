import React from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Users, 
  Trophy, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  Shield, 
  LogIn
} from 'lucide-react';
import { TeamLogo } from '@/components/events/TeamLogo';

export default function JoinTeamByLink() {
  const [, params] = useRoute<{ token: string }>('/join-team/:token');
  const token = params?.token;
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  usePageMeta({ 
    title: "Join Tournament Team", 
    description: "Accept invitation to join a badminton tournament team" 
  });

  // 1. Fetch team metadata via secure RPC
  const { data: teamInfo, isLoading, error } = useQuery({
    queryKey: ['team_invite_preview', token],
    queryFn: async () => {
      if (!token) throw new Error("No invite token provided");
      const { data, error } = await supabase.rpc('get_team_by_invite_token' as any, {
        p_token: token
      });
      if (error) throw error;
      return data as {
        team_id: string;
        team_name: string;
        short_name: string;
        tournament_id: string;
        tournament_name: string;
        captain_name: string;
        captain_avatar: string | null;
        active_members: number;
        max_roster: number;
        is_full: boolean;
      };
    },
    enabled: !!token,
    retry: 1
  });

  // 2. Join Team Mutation
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Missing invite token");
      const { data, error } = await supabase.rpc('join_team_by_token' as any, {
        p_token: token
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Successfully joined the team!');
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      queryClient.invalidateQueries({ queryKey: ['my_ties'] });
      if (teamInfo?.team_id) {
        navigate(`/team-hub/${teamInfo.team_id}`);
      } else {
        navigate('/pulse');
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to join team');
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Verifying Team Invite...</h2>
        <p className="text-sm text-slate-500 mt-1">Checking invitation token and team status</p>
      </div>
    );
  }

  if (error || !teamInfo) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-lg">
          <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/50 rounded-2xl flex items-center justify-center text-rose-600 mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
            Invite Not Valid
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {(error as any)?.message || "This invitation link is invalid, expired, or has been disabled by the team captain."}
          </p>
          <Button onClick={() => navigate('/pulse')} className="w-full">
            Explore Tournaments on Pulse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex justify-center mb-5">
          <TeamLogo
            name={teamInfo.team_name}
            shortName={teamInfo.short_name}
            size="xl"
          />
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 mb-3">
          <Trophy className="w-3.5 h-3.5 text-indigo-500" />
          Team Invitation
        </span>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Join {teamInfo.team_name}
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-1">
          {teamInfo.tournament_name}
        </p>

        {/* Details Card */}
        <div className="my-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-left space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Team Captain:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              {teamInfo.captain_name || 'Assigned Captain'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Roster Status:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-primary" />
              {teamInfo.active_members} / {teamInfo.max_roster} Players
            </span>
          </div>
        </div>

        {/* Action Button */}
        {!session ? (
          <div className="space-y-3">
            <Button 
              onClick={() => {
                sessionStorage.setItem('redirect_after_auth', `/join-team/${token}`);
                navigate('/join');
              }}
              className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Log In to Join Team
            </Button>
            <p className="text-xs text-slate-400">
              You need an IISc Badminton Club account to join the roster.
            </p>
          </div>
        ) : teamInfo.is_full ? (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            This team roster is already full ({teamInfo.max_roster} maximum players reached).
          </div>
        ) : (
          <Button 
            onClick={() => joinMutation.mutate()}
            disabled={joinMutation.isPending}
            className="w-full h-12 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
          >
            {joinMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Joining Team...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Accept & Join Squad
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        )}

      </div>
    </div>
  );
}
