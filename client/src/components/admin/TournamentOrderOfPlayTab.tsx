import React from "react";
import { OrderOfPlayPanel } from "@/components/tournament/OrderOfPlayPanel";
import type { Tournament } from "@/types/tournament";

export function TournamentOrderOfPlayTab({ tournament }: { tournament: Tournament }) {
  return <OrderOfPlayPanel tournament={tournament as any} />;
}
