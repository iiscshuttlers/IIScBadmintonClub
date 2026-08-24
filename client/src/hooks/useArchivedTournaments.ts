import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ARCHIVED_TOURNAMENTS, ArchivedTournament } from "@/data/tournamentArchive";

export function useArchivedTournaments() {
  const [archivedTournaments, setArchivedTournaments] = useState<ArchivedTournament[]>(ARCHIVED_TOURNAMENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchDynamicArchives() {
      try {
        const { data: tournaments, error: tError } = await supabase
          .from("tournaments")
          .select("id, name, description, start_date, end_date, archived_at, created_at, tournament_type")
          .eq("status", "archived")
          .order("created_at", { ascending: false });

        if (tError) throw tError;
        if (!tournaments || tournaments.length === 0) {
          if (mounted) setLoading(false);
          return;
        }

        // We only fetch tournaments that are NOT already in the hardcoded ARCHIVED_TOURNAMENTS array
        const newTournaments = tournaments.filter(
          (t) => !ARCHIVED_TOURNAMENTS.some((a) => a.id === t.id || a.name === t.name)
        );

        if (newTournaments.length === 0) {
          if (mounted) setLoading(false);
          return;
        }

        const dynamicArchives: ArchivedTournament[] = [];

        for (const t of newTournaments) {
          // Fetch final and 3rd place matches for this tournament
          const { data: matches } = await supabase
            .from("tournament_matches")
            .select("category, round_name, team1_label, team2_label, winner_side")
            .eq("tournament_id", t.id)
            .in("round_name", ["Final", "3rd Place Playoff", "Semi-Final"]);

          if (!matches || matches.length === 0) continue;

          // Group by category
          const categories = Array.from(new Set(matches.map((m) => m.category)));
          const winners = [];

          for (const cat of categories) {
            const finalMatch = matches.find((m) => m.category === cat && m.round_name === "Final");
            const thirdPlaceMatch = matches.find((m) => m.category === cat && m.round_name === "3rd Place Playoff");
            const semiFinalMatches = matches.filter((m) => m.category === cat && m.round_name === "Semi-Final");

            let winner = "";
            let runnerUp = "";
            const bronze = [];
            const fourthPlace = [];

            if (finalMatch) {
              winner = finalMatch.winner_side === 1 ? finalMatch.team1_label : finalMatch.team2_label;
              runnerUp = finalMatch.winner_side === 1 ? finalMatch.team2_label : finalMatch.team1_label;
            }

            if (thirdPlaceMatch) {
              const thirdPlaceWinner = thirdPlaceMatch.winner_side === 1 ? thirdPlaceMatch.team1_label : thirdPlaceMatch.team2_label;
              const fourthPlaceLoser = thirdPlaceMatch.winner_side === 1 ? thirdPlaceMatch.team2_label : thirdPlaceMatch.team1_label;
              if (thirdPlaceWinner) {
                bronze.push(thirdPlaceWinner);
              }
              if (fourthPlaceLoser) {
                fourthPlace.push(fourthPlaceLoser);
              }
            } else if (semiFinalMatches.length > 0) {
              // If there's no 3rd place match, both losers of the semifinals might be considered bronze
              semiFinalMatches.forEach((sm) => {
                 const loser = sm.winner_side === 1 ? sm.team2_label : sm.team1_label;
                 if (loser) bronze.push(loser);
              });
            }

            if (winner || runnerUp) {
              winners.push({
                category: cat,
                winner: winner || "TBD",
                runnerUp: runnerUp || "TBD",
                bronze: bronze.length > 0 ? bronze : undefined,
                fourthPlace: fourthPlace.length > 0 ? fourthPlace : undefined,
              });
            }
          }

          dynamicArchives.push({
            id: t.id,
            slug: t.name.toLowerCase().replace(/\s+/g, "-"),
            name: t.name,
            subtitle: "Official Results",
            description: t.description || "Tournament completed.",
            type: (t.tournament_type as any) || "open",
            startDate: t.start_date || t.end_date || t.archived_at || t.created_at || new Date().toISOString(),
            status: "archived",
            winners,
            galleryFolder: t.name,
          });
        }

        if (mounted && dynamicArchives.length > 0) {
          // Combine and sort by date descending
          const combined = [...ARCHIVED_TOURNAMENTS, ...dynamicArchives].sort((a, b) => {
            return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
          });
          setArchivedTournaments(combined);
        }
      } catch (err) {
        console.error("Failed to fetch dynamic archived tournaments", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchDynamicArchives();

    return () => {
      mounted = false;
    };
  }, []);

  return { archivedTournaments, loading };
}
