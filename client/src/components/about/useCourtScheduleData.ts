import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchSiteData } from "@/lib/siteData";
import type { Holiday, CourtReservation, ScheduledMatch } from "./courtSchedule.types";

/**
 * Owns the Court Schedule data layer: tournament matches for the selected date,
 * custom court reservations (from `site_data`, with realtime sync), and holidays.
 * `setReservations` is exposed so booking handlers can apply optimistic updates.
 */
export function useCourtScheduleData(selectedDate: string) {
  // Matches from tournament_matches
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);

  // Custom reservations from site_data
  const [reservations, setReservations] = useState<CourtReservation[]>([]);

  // Gymkhana holidays
  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["holidays"],
    queryFn: () => fetchSiteData<Holiday[]>("holidays", "holidays.json"),
    staleTime: 300_000,
  });

  // Fetch reservations + subscribe to realtime changes
  useEffect(() => {
    const fetchReservations = async () => {
      try {
        const { data } = await supabase
          .from("site_data")
          .select("value")
          .eq("key", "court_reservations")
          .maybeSingle();

        if (data?.value && Array.isArray(data.value)) {
          setReservations(data.value as unknown as CourtReservation[]);
        } else {
          setReservations([]);
        }
      } catch (err) {
        console.error("Failed to fetch reservations:", err);
      }
    };

    fetchReservations();

    const channel = supabase
      .channel("court-reservations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_data",
          filter: "key=eq.court_reservations",
        },
        () => {
          fetchReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch matches scheduled for the selected date
  useEffect(() => {
    let isCancelled = false;

    const fetchMatches = async () => {
      try {
        const startOfDay = `${selectedDate}T00:00:00.000Z`;
        const endOfDay = `${selectedDate}T23:59:59.999Z`;

        const { data: matchData } = await supabase
          .from("tournament_matches")
          .select(`
            id,
            tournament_id,
            match_code,
            category,
            court_number,
            scheduled_at,
            status,
            team1_label,
            team2_label,
            tournaments (
              id,
              name,
              tournament_type
            )
          `)
          .gte("scheduled_at", startOfDay)
          .lte("scheduled_at", endOfDay)
          .not("court_number", "is", null);

        if (!isCancelled && matchData) {
          const formatted: ScheduledMatch[] = matchData.map((m: any) => ({
            id: m.id,
            tournament_id: m.tournament_id,
            match_code: m.match_code,
            category: m.category,
            court_number: String(m.court_number || "").replace(/[^0-9]/g, ""),
            scheduled_at: m.scheduled_at,
            status: m.status,
            team1_label: m.team1_label,
            team2_label: m.team2_label,
            tournament_name: m.tournaments?.name || "Tournament",
          }));
          setMatches(formatted);
        }
      } catch (err) {
        console.error("Failed to load court matches:", err);
      }
    };

    fetchMatches();

    return () => {
      isCancelled = true;
    };
  }, [selectedDate]);

  return { matches, reservations, setReservations, holidays };
}
