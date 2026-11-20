import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService } from '@/services/teamService';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface WatchTieButtonProps {
  tieId: string;
  className?: string;
  label?: string;
  compact?: boolean;
}

export function WatchTieButton({
  tieId,
  className = '',
  label,
  compact = false,
}: WatchTieButtonProps) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  // Check if currently watching
  const { data: isWatching = false, isLoading } = useQuery({
    queryKey: ['tie_watcher', tieId, userId],
    queryFn: async () => {
      if (!userId || !tieId) return false;
      const { data, error } = await teamService.getTieWatcher(tieId, userId);

      if (error) {
        // Table might not exist or error, fallback to false
        return false;
      }
      return !!data;
    },
    enabled: !!userId && !!tieId,
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!userId) {
        toast.error('Please log in to get lineup notifications');
        return;
      }
      if (isWatching) {
        await teamService.unwatchTie(tieId, userId);
      } else {
        await teamService.watchTie(tieId, userId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['tie_watcher', tieId, userId] });
      const prev = queryClient.getQueryData(['tie_watcher', tieId, userId]);
      queryClient.setQueryData(['tie_watcher', tieId, userId], !isWatching);
      return { prev };
    },
    onError: (err: any, _vars, context) => {
      queryClient.setQueryData(['tie_watcher', tieId, userId], context?.prev);
      toast.error(err?.message || 'Failed to update reminder');
    },
    onSuccess: () => {
      if (!isWatching) {
        toast.success("You'll be notified when lineups are revealed!");
      } else {
        toast.success('Lineup reminder removed');
      }
      queryClient.invalidateQueries({ queryKey: ['tie_watcher', tieId, userId] });
    },
  });

  return (
    <button
      type="button"
      disabled={isLoading || toggleMutation.isPending}
      onClick={() => toggleMutation.mutate()}
      className={`inline-flex items-center gap-1.5 font-bold transition cursor-pointer select-none ${
        isWatching
          ? 'bg-warning/20 text-warning border border-warning/40 hover:bg-warning/30'
          : 'bg-muted text-soft border border-border-strong hover:bg-muted-strong hover:text-foreground'
      } ${
        compact
          ? 'px-2 py-0.5 rounded-lg text-[10px]'
          : 'px-3.5 py-1.5 rounded-xl text-xs'
      } ${className}`}
      title={isWatching ? 'Click to unsubscribe from reveal alert' : 'Get notified when lineups are revealed'}
    >
      {toggleMutation.isPending ? (
        <Loader2 className={compact ? 'w-3 h-3 animate-spin' : 'w-3.5 h-3.5 animate-spin'} />
      ) : (
        <Bell className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${isWatching ? 'text-warning fill-warning/30' : 'text-muted-foreground'}`} />
      )}
      <span>
        {label || (isWatching ? 'Watching Reveal' : 'Notify on Reveal')}
      </span>
    </button>
  );
}
