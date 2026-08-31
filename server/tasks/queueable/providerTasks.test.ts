import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderId } from "#shared/tasks";
import type { ProviderJobs, RecordPlaytimesResult } from "~~/lib/providerJobs";
import type { Task } from "~~/server/tasks/queue";
import { createTask } from "~~/server/tasks/queue";
import recordPlaytimes from "./recordPlaytimes";
import sync from "./sync";
import updateGames from "./updateGames";
import updateUsers from "./updateUsers";

const { registry } = vi.hoisted(() => ({ registry: [] as ProviderJobs[] }));

vi.mock("~~/lib/providerJobs", () => ({ PROVIDER_JOBS: registry }));

vi.mock("~~/server/tasks/queue", () => ({
  createTask: vi.fn(),
  updateInProgressTask: vi.fn(),
}));

const NOTHING_RECORDED: RecordPlaytimesResult = {
  gamesCreated: 0,
  unknownGames: 0,
};

function stubProvider(
  provider: ProviderId,
  overrides: Partial<ProviderJobs> = {},
): ProviderJobs {
  return {
    provider,
    isActive: async () => true,
    updateUser: async () => {},
    updateGames: async () => {},
    recordPlaytimes: async () => NOTHING_RECORDED,
    ...overrides,
  };
}

function setRegistry(...jobs: ProviderJobs[]) {
  registry.splice(0, registry.length, ...jobs);
}

function makeTask(payload?: Task["payload"]): Task {
  return {
    id: 1,
    name: "sync",
    state: "in_progress",
    ...(payload ? { payload } : {}),
  };
}

function queuedTasks() {
  return vi.mocked(createTask).mock.calls;
}

beforeEach(() => {
  vi.mocked(createTask).mockClear();
  setRegistry();
});

describe("updateUsers", () => {
  it("updates every active provider's user", async () => {
    const updated: ProviderId[] = [];
    setRegistry(
      ...(["steam", "gog"] as const).map((provider) =>
        stubProvider(provider, {
          updateUser: async () => {
            updated.push(provider);
          },
        }),
      ),
    );

    await updateUsers(makeTask());

    expect(updated).toStrictEqual(["steam", "gog"]);
  });

  it("throws an aggregate error when a provider fails", async () => {
    setRegistry(
      stubProvider("steam", {
        updateUser: async () => {
          throw new Error("no api key");
        },
      }),
      stubProvider("gog"),
    );

    await expect(updateUsers(makeTask())).rejects.toThrow("Failed for Steam");
  });
});

describe("updateGames", () => {
  it("queues steam PICS metadata after a successful steam update", async () => {
    setRegistry(stubProvider("steam"), stubProvider("gog"));

    await updateGames(makeTask());

    expect(queuedTasks()).toStrictEqual([["updateSteamPicsMetadata"]]);
  });

  it("does not queue steam PICS metadata when steam is inactive", async () => {
    setRegistry(
      stubProvider("steam", { isActive: async () => false }),
      stubProvider("gog"),
    );

    await updateGames(makeTask());

    expect(queuedTasks()).toStrictEqual([]);
  });

  it("does not queue steam PICS metadata when steam fails", async () => {
    setRegistry(
      stubProvider("steam", {
        updateGames: async () => {
          throw new Error("steam is down");
        },
      }),
    );

    await expect(updateGames(makeTask())).rejects.toThrow("Failed for Steam");
    expect(queuedTasks()).toStrictEqual([]);
  });
});

describe("recordPlaytimes", () => {
  it("queues the enrichment tasks when games were created", async () => {
    setRegistry(
      stubProvider("steam", {
        recordPlaytimes: async () => ({ gamesCreated: 2, unknownGames: 0 }),
      }),
    );

    await recordPlaytimes(makeTask());

    expect(queuedTasks()).toStrictEqual([
      ["updateSteamPicsMetadata"],
      ["populateStoreData"],
      ["cacheArt"],
    ]);
  });

  it("queues a games update for a provider reporting unknown games", async () => {
    setRegistry(
      stubProvider("steam"),
      stubProvider("gog", {
        recordPlaytimes: async () => ({ gamesCreated: 0, unknownGames: 3 }),
      }),
      stubProvider("epic"),
    );

    await recordPlaytimes(makeTask());

    expect(queuedTasks()).toStrictEqual([["updateGames", { provider: "gog" }]]);
  });

  it("queues nothing when there is nothing to follow up", async () => {
    setRegistry(stubProvider("steam"), stubProvider("gog"));

    await recordPlaytimes(makeTask());

    expect(queuedTasks()).toStrictEqual([]);
  });
});

describe("sync", () => {
  it("runs the three jobs in order for the provider named in the payload", async () => {
    const ran: string[] = [];
    setRegistry(
      stubProvider("steam", {
        updateUser: async () => {
          ran.push("steam user");
        },
      }),
      stubProvider("gog", {
        updateUser: async () => {
          ran.push("gog user");
        },
        updateGames: async () => {
          ran.push("gog games");
        },
        recordPlaytimes: async () => {
          ran.push("gog playtimes");
          return NOTHING_RECORDED;
        },
      }),
    );

    await sync(makeTask({ provider: "gog" }));

    expect(ran).toStrictEqual(["gog user", "gog games", "gog playtimes"]);
  });

  it("queues the follow-ups from both the games and playtime jobs once", async () => {
    setRegistry(
      stubProvider("steam", {
        recordPlaytimes: async () => ({ gamesCreated: 1, unknownGames: 0 }),
      }),
      stubProvider("epic", {
        recordPlaytimes: async () => ({ gamesCreated: 0, unknownGames: 1 }),
      }),
    );

    await sync(makeTask());

    expect(queuedTasks()).toStrictEqual([
      ["updateSteamPicsMetadata"],
      ["populateStoreData"],
      ["cacheArt"],
      ["updateGames", { provider: "epic" }],
    ]);
  });
});
