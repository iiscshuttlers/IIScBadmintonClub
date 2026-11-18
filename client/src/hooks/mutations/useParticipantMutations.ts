import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addTournamentParticipant,
  deleteTournamentParticipant,
  updateTournamentParticipants,
  bulkUpsertParticipants,
} from "@/services/tournamentService";
import type { ParticipantInsert } from "@/types/tournament";

export function useAddParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      tournamentId: string;
      category: string;
      playerId: string | null;
      partnerId: string | null;
      displayName: string | null;
      seed?: number | null;
    }) => {
      await addTournamentParticipant({
        tournament_id: payload.tournamentId,
        category: payload.category,
        player_id: payload.playerId,
        partner_id: payload.partnerId,
        display_name: payload.displayName || "",
        seed: payload.seed ?? null,
      });
    },
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId, "participants"] });
      toast.success("Participant added");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to add participant");
    },
  });
}

export function useRemoveParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tournamentId: _tId, id }: { tournamentId: string; id: string }) => {
      await deleteTournamentParticipant(id);
    },
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId, "participants"] });
      toast.success("Participant removed");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to remove participant");
    },
  });
}

export function useSeedParticipants() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tournamentId: _tId, updates }: { tournamentId: string; updates: { id: string; seed: number }[] }) => {
      await updateTournamentParticipants(
        updates.map((u) => ({ id: u.id, patch: { seed: u.seed } }))
      );
    },
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId, "participants"] });
      toast.success("Seeds saved");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to update seeds");
    },
  });
}

export function useBulkImportParticipants() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tournamentId: _tId, rows }: { tournamentId: string; rows: ParticipantInsert[] }) => {
      await bulkUpsertParticipants(rows);
    },
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId, "participants"] });
      toast.success("Participants imported");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to bulk import participants");
    },
  });
}
