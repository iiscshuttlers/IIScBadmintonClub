import React from "react";
import { TeamDetailModal, TeamDetailModalProps } from "@/components/events/TeamDetailModal";

export type { TeamDetailModalProps as TeamRosterModalProps };

export function TeamRosterModal(props: TeamDetailModalProps) {
  return <TeamDetailModal {...props} />;
}
