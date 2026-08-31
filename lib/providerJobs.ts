import type { ProviderId } from "#shared/tasks";
import * as steam from "~~/lib/steam/service";
import * as gog from "~~/lib/gog/service";
import * as epic from "~~/lib/epic/service";

export type { ProviderId };

export type OnProgress = (update: {
  fraction?: number;
  message: string;
}) => void | Promise<void>;

export interface RecordPlaytimesResult {
  gamesCreated: number;
  unknownGames: number;
}

export interface ProviderJobs {
  provider: ProviderId;
  isActive(): Promise<boolean>;
  updateUser(): Promise<void>;
  updateGames(onProgress?: OnProgress): Promise<void>;
  recordPlaytimes(onProgress?: OnProgress): Promise<RecordPlaytimesResult>;
}

const steamJobs: ProviderJobs = {
  provider: "steam",
  async isActive() {
    const user = await steam.getSteamUser();
    return !!user?.apiKey;
  },
  async updateUser() {
    await steam.updateUser();
  },
  async updateGames(onProgress) {
    await steam.updateGames(onProgress);
  },
  recordPlaytimes: (onProgress) => steam.recordPlaytimes(onProgress),
};

const gogJobs: ProviderJobs = {
  provider: "gog",
  async isActive() {
    return !!(await gog.getGogUser());
  },
  async updateUser() {
    await gog.updateGogUser();
  },
  updateGames: (onProgress) => gog.updateGogGames(onProgress),
  recordPlaytimes: (onProgress) => gog.recordGogPlaytimes(onProgress),
};

const epicJobs: ProviderJobs = {
  provider: "epic",
  async isActive() {
    return !!(await epic.getEpicUser());
  },
  async updateUser() {
    await epic.updateEpicUser();
  },
  updateGames: (onProgress) => epic.updateEpicGames(onProgress),
  recordPlaytimes: (onProgress) => epic.recordEpicPlaytimes(onProgress),
};

export const PROVIDER_JOBS: ProviderJobs[] = [steamJobs, gogJobs, epicJobs];
