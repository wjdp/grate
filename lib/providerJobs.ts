import type { ProviderId } from "#shared/tasks";
import * as epic from "~~/lib/epic/service";
import * as gog from "~~/lib/gog/service";
import * as steam from "~~/lib/steam/service";

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

let hasWarnedSteamSessionExpired = false;

function warnSteamSessionExpiredOnce() {
  if (hasWarnedSteamSessionExpired) return;
  hasWarnedSteamSessionExpired = true;
  console.warn(
    "Steam session expired, re-scan the QR code on the providers page",
  );
}

const steamJobs: ProviderJobs = {
  provider: "steam",
  async isActive() {
    const user = await steam.getSteamUser();
    if (!user?.refreshToken || !user.refreshTokenExpiresAt) return false;
    if (user.refreshTokenExpiresAt > new Date()) return true;
    warnSteamSessionExpiredOnce();
    return false;
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
