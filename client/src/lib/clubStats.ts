/** The "Club at a glance" numbers on the About page, edited in admin Content → Club page. */
export interface ClubStats {
  members: string;
  tournaments: string;
  courts: string;
  trophies: string;
}

export const CLUB_STAT_FIELDS: { key: keyof ClubStats; label: string; placeholder: string }[] = [
  { key: "members", label: "Active members", placeholder: "e.g. 350+" },
  { key: "tournaments", label: "Tournaments", placeholder: "e.g. 20+" },
  { key: "courts", label: "Indoor courts", placeholder: "e.g. 3" },
  { key: "trophies", label: "IISM trophies", placeholder: "e.g. 10+" },
];
