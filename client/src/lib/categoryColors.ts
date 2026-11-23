/**
 * Text colour per event category, so a glance tells you the discipline
 * (MS, WS, MD, WD, XD, plus junior BS/GS/BD/GD). Unknown categories fall
 * back to the soft text colour.
 */
const CATEGORY_TEXT: Record<string, string> = {
  MS: "text-cat-ms",
  WS: "text-cat-ws",
  MD: "text-cat-md",
  WD: "text-cat-wd",
  XD: "text-cat-xd",
  BS: "text-accent",
  GS: "text-danger",
  BD: "text-team",
  GD: "text-individual",
};

export const categoryTextClass = (category?: string | null) =>
  CATEGORY_TEXT[(category || "").trim().toUpperCase()] || "text-soft";
