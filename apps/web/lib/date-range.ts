/** UTC calendar-month boundaries, `offsetMonths` months before the current one (0 = this month). */
export function getMonthRange(offsetMonths = 0, from = new Date()) {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - offsetMonths, 1));
  const end = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - offsetMonths + 1, 1));
  return { start, end };
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2025-03" -> "Mar 2025" */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`;
}
