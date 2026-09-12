import type { ImprecisePlaytime } from "#shared/types/Activity";
import { formatPlaytime } from "./formatPlaytime";

export function impreciseMinutes(imprecise: ImprecisePlaytime): number {
  return (
    imprecise.yearOnly +
    imprecise.months.reduce((total, month) => total + month.minutes, 0)
  );
}

// `month` is a plain year-month, so it is read as local midnight rather than
// through `new Date("YYYY-MM")`, which parses as UTC.
function formatMonthName(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year ?? 0, (monthNumber ?? 1) - 1, 1).toLocaleDateString(
    "en-GB",
    { month: "short" },
  );
}

export function formatImprecisePlaytime(
  imprecise: ImprecisePlaytime,
  year: number,
): string | null {
  const total = impreciseMinutes(imprecise);
  if (total === 0) return null;

  const parts = imprecise.months.map(
    (month) =>
      `${formatMonthName(month.month)} ${formatPlaytime(month.minutes)}`,
  );
  if (imprecise.yearOnly > 0) {
    parts.push(`sometime in ${year} ${formatPlaytime(imprecise.yearOnly)}`);
  }
  return `Plus ${formatPlaytime(total)} imprecisely dated: ${parts.join(", ")}`;
}
