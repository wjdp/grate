export type PlaytimeProvider = "steam" | "gog" | "epic";

export interface PlaytimeSessionCorrection {
  id: number;
  playedFrom: string;
  playedTo: string;
  note: string | null;
}

export interface PlaytimeSession {
  provider: PlaytimeProvider;
  providerId: number;
  providerName: string;
  minutes: number;
  endedAfter: Date;
  endedBefore: Date;
  estimatedStart: Date;
  estimatedEnd: Date;
  uncertaintyMinutes: number;
  anchored: boolean;
  playDay: string | null;
  calendarMonth: string | null;
  calendarYear: number | null;
  // Set only on single-delta observed and residual sessions: the row a
  // correction can re-place. Merged and corrected sessions carry null.
  snapshotId: number | null;
  correction: PlaytimeSessionCorrection | null;
}

// Playtime a provider reported before grate started watching, which no
// correction has dated yet.
export interface UndatedPlaytime {
  provider: PlaytimeProvider;
  providerId: number;
  providerName: string;
  snapshotId: number;
  minutes: number;
}

// Routes hand sessions to the client as JSON, so every Date arrives as an ISO string.
export type PlaytimeSessionJson = Omit<
  PlaytimeSession,
  "endedAfter" | "endedBefore" | "estimatedStart" | "estimatedEnd"
> & {
  endedAfter: string;
  endedBefore: string;
  estimatedStart: string;
  estimatedEnd: string;
};

export interface PlaytimeCorrectionJson {
  id: number;
  provider: PlaytimeProvider;
  providerId: number;
  snapshotId: number | null;
  minutes: number;
  playedFrom: string;
  playedTo: string;
  note: string | null;
  createdAt: string;
}
