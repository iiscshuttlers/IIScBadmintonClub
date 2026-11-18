import React from "react";
import { SendReminderSheet } from "@/components/tournament/SendReminderSheet";
import type { Tournament } from "@/types/tournament";

export function TournamentNotificationsTab({
  tournament,
  open,
  onClose,
}: {
  tournament: Tournament;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <SendReminderSheet
      open={open}
      onClose={onClose}
      tournament={{ id: tournament.id, name: tournament.name, slug: tournament.slug }}
    />
  );
}
