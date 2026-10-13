// Pure helpers + constants for the Court Schedule timeline.

// Operating Hours: 6:00 AM to 10:20 PM
export const DAY_START_MINUTES = 6 * 60; // 360 mins (6:00 AM)
export const DAY_END_MINUTES = 22 * 60 + 20; // 1340 mins (10:20 PM)
export const TOTAL_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES; // 980 mins

// Convert "09:00" to "9 AM", "13:00" to "1 PM", "19:00" to "7 PM", "22:20" to "10:20 PM"
export function formatTime12h(timeStr: string): string {
  if (!timeStr) return "";
  if (timeStr.toLowerCase().includes("am") || timeStr.toLowerCase().includes("pm")) {
    return timeStr;
  }
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const formattedH = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${formattedH} ${ampm}` : `${formattedH}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Convert "09:30" to minutes-since-midnight (570).
export function timeStrToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
