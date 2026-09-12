export interface DailyPlaytime {
  date: string;
  minutes: number;
}

export interface MonthlyPlaytime {
  month: string;
  minutes: number;
}

// Corrections dated only to a month or a year cannot be placed on a day, so
// they are reported alongside the daily totals rather than fabricated onto one.
export interface ImprecisePlaytime {
  months: MonthlyPlaytime[];
  yearOnly: number;
}

export interface ActivityYear {
  days: DailyPlaytime[];
  imprecise: ImprecisePlaytime;
}
