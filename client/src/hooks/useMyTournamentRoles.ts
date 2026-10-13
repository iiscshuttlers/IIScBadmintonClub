import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface MyRole {
  registration?: "pending" | "approved" | "rejected" | "withdrawn";
  roles: Set<string>;
  isCreator: boolean;
}

/** Serializable shape stored in the (persisted) react-query cache. */
interface MyRoleRow {
  tournament_id: string;
  registration?: "pending" | "approved" | "rejected" | "withdrawn";
  roles: string[];
  isCreator: boolean;
}

export function useMyTournamentRoles(userId?: string | null, tournaments: any[] = []) {
  const createdIds = tournaments.filter(t => t.created_by === userId).map(t => t.id);

  // NOTE: cache plain arrays (not Map/Set) — react-query is persisted to
  // localStorage, where Map/Set serialize to {} and lose their methods.
  // The Map<…, MyRole> is rebuilt client-side via useMemo below.
  const { data: rows = [], refetch, isLoading } = useQuery<MyRoleRow[]>({
    queryKey: ["my-tournament-roles", userId, [...createdIds].sort().join(",")],
    queryFn: async () => {
      if (!userId) return [];
      const byId = new Map<string, MyRoleRow>();
      const ensure = (id: string) => {
        let e = byId.get(id);
        if (!e) { e = { tournament_id: id, roles: [], isCreator: false }; byId.set(id, e); }
        return e;
      };

      createdIds.forEach((id) => {
        const e = ensure(id);
        e.isCreator = true;
        if (!e.roles.includes("ORGANIZER")) e.roles.push("ORGANIZER");
      });

      const { data: regs, error: regError } = await supabase
        .from("tournament_registrations")
        .select("tournament_id, status")
        .eq("player_id", userId);
      if (!regError && regs) {
        regs.forEach((r: any) => { ensure(r.tournament_id).registration = r.status; });
      }

      const { data: officials, error: offError } = await supabase
        .from("tournament_officials")
        .select("tournament_id, role")
        .eq("user_id", userId);
      if (!offError && officials) {
        officials.forEach((o: any) => {
          const e = ensure(o.tournament_id);
          const role = o.role?.toUpperCase();
          if (role && !e.roles.includes(role)) e.roles.push(role);
        });
      }

      return [...byId.values()];
    },
    enabled: !!userId,
    staleTime: 30000,
  });

  const myRoles = useMemo(
    () => new Map<string, MyRole>(
      (Array.isArray(rows) ? rows : []).map((r) => [r.tournament_id, {
        registration: r.registration,
        roles: new Set(r.roles),
        isCreator: r.isCreator,
      }]),
    ),
    [rows],
  );

  return { myRoles, refetch, isLoading };
}
