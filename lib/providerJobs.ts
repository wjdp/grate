import type { ProviderId } from "#shared/tasks";

export type { ProviderId };

export type OnProgress = (update: {
  fraction?: number;
  message: string;
}) => void | Promise<void>;

export interface RecordPlaytimesResult {
  gamesCreated: number;
  unknownGames: number;
}
