// Conversions between a stored UTC timestamp and the value an
// <input type="datetime-local"> expects.
//
// The input works entirely in the user's local time and has no timezone
// component, so `toISOString()` cannot be used to fill it — that would show the
// UTC wall-clock time and silently shift every match by the UTC offset (5½
// hours here). Build the local parts explicitly instead.

const pad = (n: number) => String(n).padStart(2, "0");

/** Format a stored timestamp as `YYYY-MM-DDTHH:mm` in local time. */
export function toLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Turn a `datetime-local` value back into a UTC timestamp for storage.
 * Returns null when the value is empty or not a real date.
 */
export function localDateTimeInputToIso(value: string): string | null {
  if (!value) return null;
  // `new Date("YYYY-MM-DDTHH:mm")` is interpreted as local time, which is what
  // the input means.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
