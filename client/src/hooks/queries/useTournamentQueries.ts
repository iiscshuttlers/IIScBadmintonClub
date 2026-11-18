import { useQuery } from "@tanstack/react-query";
import {
  fetchTournaments,
  fetchTournamentById,
  fetchTournamentMatches,
  fetchTournamentParticipants,
  fetchTournamentRegistrations,
} from "@/services/tournamentService";
import type { Tournament, TournamentMatch, Participant, Registration } from "@/types/tournament";

export function useTournamentList(opts?: { status?: string[] }) {
  return useQuery<Tournament[]>({
    queryKey: opts?.status ? ["tournaments", { status: opts.status }] : ["tournaments"],
    queryFn: () => fetchTournaments(opts),
    staleTime: 30_000,
  });
}

export function useTournamentDetail(id: string | null | undefined) {
  return useQuery<Tournament | null>({
    queryKey: ["tournament", id],
    queryFn: () => {
      if (!id) return null;
      return fetchTournamentById(id);
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useTournamentMatches(tournamentId: string | null | undefined) {
  return useQuery<TournamentMatch[]>({
    queryKey: ["tournament", tournamentId, "matches"],
    queryFn: () => {
      if (!tournamentId) return [];
      return fetchTournamentMatches(tournamentId);
    },
    enabled: !!tournamentId,
    staleTime: 30_000,
  });
}

export function useTournamentParticipants(tournamentId: string | null | undefined) {
  return useQuery<Participant[]>({
    queryKey: ["tournament", tournamentId, "participants"],
    queryFn: () => {
      if (!tournamentId) return [];
      return fetchTournamentParticipants(tournamentId);
    },
    enabled: !!tournamentId,
    staleTime: 30_000,
  });
}

export function useTournamentRegistrations(tournamentId: string | null | undefined) {
  return useQuery<Registration[]>({
    queryKey: ["tournament", tournamentId, "registrations"],
    queryFn: () => {
      if (!tournamentId) return [];
      return fetchTournamentRegistrations(tournamentId);
    },
    enabled: !!tournamentId,
    staleTime: 30_000,
  });
}
