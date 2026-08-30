export function formatDateIso(date: Date): string {
  // format and return only the date part, YYYY-MM-DD
  return date.toISOString().split("T")[0];
}
