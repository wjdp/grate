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
}
