import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSiteDataEntry } from "@/services/playerService";
import { hubService } from "@/services/hubService";
import { fetchCourtMatchesBetween } from "@/services/tournamentService";
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
        const { data } = await fetchSiteDataEntry("court_reservations");

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

    return hubService.subscribeToCourtReservations(() => {
      fetchReservations();
    });
  }, []);

  // Fetch matches scheduled for the selected date
  useEffect(() => {
    let isCancelled = false;

    const fetchMatches = async () => {
      try {
        const startOfDay = `${selectedDate}T00:00:00.000Z`;
        const endOfDay = `${selectedDate}T23:59:59.999Z`;

        const matchData = await fetchCourtMatchesBetween(startOfDay, endOfDay);

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
