import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createTournament,
  updateTournament,
  archiveTournament,
  deleteTournament,
  advanceTournamentWinner,
  approveTournamentRegistration,
  rejectTournamentRegistration,
  bulkUpsertParticipants,
  updateTournamentMatch,
} from "@/services/tournamentService";
import type {
  Tournament,
  TournamentInsert,
  TournamentMatch,
  ParticipantInsert,
} from "@/types/tournament";

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TournamentInsert) => createTournament(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament created");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to create tournament");
    },
  });
}

export function useUpdateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Tournament> }) =>
      updateTournament(id, patch),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournament", id] });
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to update tournament");
    },
  });
}

export function useDeleteTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTournament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament deleted");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to delete tournament");
    },
  });
}

export function useArchiveTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveTournament(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournament", id] });
      toast.success("Tournament archived");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to archive tournament");
    },
  });
}

export function useAdvanceTournamentWinner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tournamentId: _tId, matchId, winnerId }: { tournamentId: string; matchId: string; winnerId?: string }) =>
      advanceTournamentWinner(matchId, winnerId),
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId, "matches"] });
      toast.success("Winner advanced");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to advance winner");
    },
  });
}

export function useApproveTournamentRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tournamentId: _tId, id, reviewerId }: { tournamentId: string; id: string; reviewerId?: string | null }) =>
      approveTournamentRegistration(id, reviewerId),
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId, "registrations"] });
      toast.success("Registration approved");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to approve registration");
    },
  });
}

export function useRejectTournamentRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tournamentId: _tId, id, reviewerId }: { tournamentId: string; id: string; reviewerId?: string | null }) =>
      rejectTournamentRegistration(id, reviewerId),
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId, "registrations"] });
      toast.success("Registration rejected");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to reject registration");
    },
  });
}

export function useBulkUpsertParticipants() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tournamentId: _tId, rows }: { tournamentId: string; rows: ParticipantInsert[] }) =>
      bulkUpsertParticipants(rows),
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId, "participants"] });
      toast.success("Participants updated");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to update participants");
    },
  });
}

export function useUpdateTournamentMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tournamentId: _tId, matchId, patch }: { tournamentId: string; matchId: string; patch: Partial<TournamentMatch> }) =>
      updateTournamentMatch(matchId, patch),
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId, "matches"] });
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to update match");
    },
  });
}
