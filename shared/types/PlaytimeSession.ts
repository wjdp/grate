export type PlaytimeProvider = "steam" | "gog" | "epic";

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
  playDay: string;
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
