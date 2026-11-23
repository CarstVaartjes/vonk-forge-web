const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The one calendar-date format of this site: "20 Nov 2026" (day, short month, year), read in UTC. A value that is not a date is shown as given. */
export function formatDate(value: string | number | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
