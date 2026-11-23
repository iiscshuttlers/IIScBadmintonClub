/**
 * React Query hooks for in-app registration. Every query is disabled while the
 * tournament's `require_app_registration` flag is off (or it's a TEAM event),
 * so flag-off tournaments make no calls to the new tables.
 *
 * Query functions return plain arrays/objects only: the cache is persisted to
 * sessionStorage (never a Set or Map; see react-query-cache-is-persisted).
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EMPTY_MY_REGISTRATION, fetchAttention, fetchCategorySettings, fetchDrawnCategories, fetchMyRegistration,
  fetchMyWaitlistPositions, fetchOrganiserRegistration, fetchPartnerConflicts, fetchPickerPlayers, fetchRegistrationEntries,
  fetchWaitlistCounts,
  isRegistrationFlagOn,
} from "@/services/tournament/registrationEntries";
import { registrationWindow, type RegistrationWindow } from "@/lib/registration/window";
import type { CategorySettings, RegistrationTournament } from "@/types/registration";

export const registrationKeys = {
  all: (tournamentId: string) => ["registration", tournamentId] as const,
  settings: (tournamentId: string) => ["registration", tournamentId, "settings"] as const,
  drawn: (tournamentId: string) => ["registration", tournamentId, "drawn"] as const,
  mine: (tournamentId: string, playerId: string | null | undefined) => ["registration", tournamentId, "mine", playerId ?? null] as const,
  entries: (tournamentId: string) => ["registration", tournamentId, "entries"] as const,
  organiser: (tournamentId: string) => ["registration", tournamentId, "organiser"] as const,
  attention: (tournamentId: string) => ["registration", tournamentId, "attention"] as const,
  conflicts: (tournamentId: string) => ["registration", tournamentId, "conflicts"] as const,
  waitlistCounts: (tournamentId: string) => ["registration", tournamentId, "waitlist-counts"] as const,
  myWaitlist: (tournamentId: string, playerId: string | null | undefined) => ["registration", tournamentId, "my-waitlist", playerId ?? null] as const,
};

export function useCategorySettings(t: RegistrationTournament | null | undefined) {
  const on = isRegistrationFlagOn(t);
  return useQuery({
    queryKey: registrationKeys.settings(t?.id ?? ""),
    queryFn: () => fetchCategorySettings(t!),
    enabled: on && !!t?.id,
    staleTime: 30_000,
  });
}

export function useDrawnCategories(t: RegistrationTournament | null | undefined) {
  const on = isRegistrationFlagOn(t);
  return useQuery({
    queryKey: registrationKeys.drawn(t?.id ?? ""),
    queryFn: () => fetchDrawnCategories(t!),
    enabled: on && !!t?.id,
    staleTime: 30_000,
  });
}

/** Window (state, deadline) per category; empty when the flag is off. */
export function useRegistrationWindows(t: RegistrationTournament | null | undefined): Record<string, RegistrationWindow> {
  const { data: settings } = useCategorySettings(t);
  const { data: drawn } = useDrawnCategories(t);
  return useMemo(() => {
    const out: Record<string, RegistrationWindow> = {};
    if (!t || !isRegistrationFlagOn(t)) return out;
    const list: CategorySettings[] = Array.isArray(settings) ? settings : [];
    const drawnList: string[] = Array.isArray(drawn) ? drawn : [];
    for (const cat of t.categories ?? []) {
      const s = list.find((x) => x.category === cat);
      out[cat] = registrationWindow({
        flagOn: true,
        formatFamily: t.format_family,
        status: t.status,
        tournamentOpensAt: t.registration_opens_at,
        tournamentClosesAt: t.form_close_date,
        categoryOpensAt: s?.opens_at,
        categoryClosesAt: s?.closes_at,
        lockedAt: s?.locked_at,
        hasDraw: drawnList.some((d) => d.toUpperCase() === cat.toUpperCase()),
      });
    }
    return out;
  }, [t, settings, drawn]);
}

export function useMyRegistration(t: RegistrationTournament | null | undefined, playerId: string | null | undefined) {
  const on = isRegistrationFlagOn(t);
  return useQuery({
    queryKey: registrationKeys.mine(t?.id ?? "", playerId),
    queryFn: () => fetchMyRegistration(t!, playerId),
    enabled: on && !!t?.id && !!playerId,
    placeholderData: EMPTY_MY_REGISTRATION,
    staleTime: 15_000,
  });
}

export function useRegistrationEntries(t: RegistrationTournament | null | undefined, enabled = true) {
  const on = isRegistrationFlagOn(t);
  return useQuery({
    queryKey: registrationKeys.entries(t?.id ?? ""),
    queryFn: () => fetchRegistrationEntries(t!),
    enabled: enabled && on && !!t?.id,
    staleTime: 15_000,
  });
}

export function useOrganiserRegistration(t: RegistrationTournament | null | undefined, enabled = true) {
  const on = isRegistrationFlagOn(t);
  return useQuery({
    queryKey: registrationKeys.organiser(t?.id ?? ""),
    queryFn: () => fetchOrganiserRegistration(t!),
    enabled: enabled && on && !!t?.id,
    staleTime: 15_000,
  });
}

export function useRegistrationAttention(t: RegistrationTournament | null | undefined, enabled = true) {
  const on = isRegistrationFlagOn(t);
  return useQuery({
    queryKey: registrationKeys.attention(t?.id ?? ""),
    queryFn: () => fetchAttention(t!.id),
    enabled: enabled && on && !!t?.id,
    staleTime: 15_000,
  });
}

export function usePartnerConflicts(t: RegistrationTournament | null | undefined, enabled = true) {
  const on = isRegistrationFlagOn(t);
  return useQuery({
    queryKey: registrationKeys.conflicts(t?.id ?? ""),
    queryFn: () => fetchPartnerConflicts(t!.id),
    enabled: enabled && on && !!t?.id,
    staleTime: 15_000,
  });
}

export function useWaitlistCounts(t: RegistrationTournament | null | undefined) {
  const on = isRegistrationFlagOn(t);
  return useQuery({
    queryKey: registrationKeys.waitlistCounts(t?.id ?? ""),
    queryFn: () => fetchWaitlistCounts(t!),
    enabled: on && !!t?.id,
    staleTime: 30_000,
  });
}

/** A registration write that refreshes every registration query of the tournament (and the participants list). */
export function useRegistrationMutation<TArgs, TResult>(tournamentId: string | null | undefined, fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      if (!tournamentId) return;
      qc.invalidateQueries({ queryKey: registrationKeys.all(tournamentId) });
      qc.invalidateQueries({ queryKey: ["tournament-participants", tournamentId] });
      qc.invalidateQueries({ queryKey: ["my-tournament-roles"] });
    },
  });
}

export function useMyWaitlistPositions(t: RegistrationTournament | null | undefined, playerId: string | null | undefined) {
  const on = isRegistrationFlagOn(t);
  return useQuery({
    queryKey: registrationKeys.myWaitlist(t?.id ?? "", playerId),
    queryFn: () => fetchMyWaitlistPositions(t!),
    enabled: on && !!t?.id && !!playerId,
    staleTime: 15_000,
  });
}

/** Members for the partner picker (loaded only when the picker opens). */
export function usePickerPlayers(enabled: boolean) {
  return useQuery({
    queryKey: ["registration-picker-players"],
    queryFn: fetchPickerPlayers,
    enabled,
    staleTime: 5 * 60_000,
  });
}
