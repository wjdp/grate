import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderId } from "#shared/tasks";
import type { ProviderJobs } from "~~/server/providers/jobs";
import {
  runProviderJobs,
  throwOnProviderFailures,
} from "~~/server/tasks/providerRunner";
import type { Task } from "~~/server/tasks/queue";
import { updateInProgressTask } from "~~/server/tasks/queue";

vi.mock("~~/server/tasks/queue", () => ({
  updateInProgressTask: vi.fn(),
}));

function stubProvider(
  provider: ProviderId,
  overrides: Partial<ProviderJobs> = {},
): ProviderJobs {
  return {
    provider,
    isActive: async () => true,
    updateUser: async () => {},
    updateGames: async () => {},
    recordPlaytimes: async () => ({ gamesCreated: 0, unknownGames: 0 }),
    ...overrides,
  };
}

function makeTask(payload?: Task["payload"]): Task {
  return {
    id: 1,
    name: "recordPlaytimes",
    state: "in_progress",
    ...(payload ? { payload } : {}),
  };
}

function progressUpdates() {
  return vi.mocked(updateInProgressTask).mock.calls.map(([, update]) => update);
}

beforeEach(() => {
  vi.mocked(updateInProgressTask).mockClear();
});

describe("runProviderJobs", () => {
  it("runs every active provider in order and collects results", async () => {
    const ran: ProviderId[] = [];
    const registry = (["steam", "gog", "epic"] as const).map((provider) =>
      stubProvider(provider, {
        updateGames: async () => {
          ran.push(provider);
        },
      }),
    );

    const outcome = await runProviderJobs(
      makeTask(),
      [async (jobs, onProgress) => jobs.updateGames(onProgress)],
      registry,
    );

    expect(ran).toStrictEqual(["steam", "gog", "epic"]);
    expect(outcome.failures).toStrictEqual([]);
    expect(outcome.runs.map((run) => run.provider)).toStrictEqual([
      "steam",
      "gog",
      "epic",
    ]);
  });

  it("skips inactive providers with a progress message", async () => {
    const ran: ProviderId[] = [];
    const registry = [
      stubProvider("steam", { isActive: async () => false }),
      stubProvider("gog", {
        updateGames: async () => {
          ran.push("gog");
        },
      }),
    ];

    const outcome = await runProviderJobs(
      makeTask(),
      [async (jobs, onProgress) => jobs.updateGames(onProgress)],
      registry,
    );

    expect(ran).toStrictEqual(["gog"]);
    expect(outcome.runs.map((run) => run.provider)).toStrictEqual(["gog"]);
    expect(progressUpdates()).toContainEqual({
      message: "Steam: not connected, skipped",
    });
  });

  it("runs only the provider named in the payload", async () => {
    const ran: ProviderId[] = [];
    const registry = (["steam", "gog", "epic"] as const).map((provider) =>
      stubProvider(provider, {
        updateGames: async () => {
          ran.push(provider);
        },
      }),
    );

    await runProviderJobs(
      makeTask({ provider: "gog" }),
      [async (jobs, onProgress) => jobs.updateGames(onProgress)],
      registry,
    );

    expect(ran).toStrictEqual(["gog"]);
  });

  it("keeps going when one provider fails and reports the failure", async () => {
    const ran: ProviderId[] = [];
    const registry = [
      stubProvider("steam", {
        updateGames: async () => {
          throw new Error("steam is down");
        },
      }),
      stubProvider("gog", {
        updateGames: async () => {
          ran.push("gog");
        },
      }),
    ];

    const outcome = await runProviderJobs(
      makeTask(),
      [async (jobs, onProgress) => jobs.updateGames(onProgress)],
      registry,
    );

    expect(ran).toStrictEqual(["gog"]);
    expect(outcome.runs.map((run) => run.provider)).toStrictEqual(["gog"]);
    expect(outcome.failures.map((failure) => failure.provider)).toStrictEqual([
      "steam",
    ]);
  });

  it("abandons the remaining steps for a provider that fails", async () => {
    const ran: string[] = [];
    const registry = [
      stubProvider("steam", {
        updateUser: async () => {
          throw new Error("no api key");
        },
        updateGames: async () => {
          ran.push("steam games");
        },
      }),
      stubProvider("gog", {
        updateUser: async () => {
          ran.push("gog user");
        },
        updateGames: async () => {
          ran.push("gog games");
        },
      }),
    ];

    const outcome = await runProviderJobs(
      makeTask(),
      [
        async (jobs) => jobs.updateUser(),
        async (jobs, onProgress) => jobs.updateGames(onProgress),
      ],
      registry,
    );

    expect(ran).toStrictEqual(["gog user", "gog games"]);
    expect(outcome.failures.map((failure) => failure.provider)).toStrictEqual([
      "steam",
    ]);
  });

  it("scales progress fractions across providers and steps", async () => {
    const registry = [
      stubProvider("steam", {
        updateGames: async (onProgress) => {
          await onProgress?.({ fraction: 0.5, message: "halfway" });
        },
      }),
      stubProvider("gog", {
        updateGames: async (onProgress) => {
          await onProgress?.({ fraction: 0.5, message: "halfway" });
        },
      }),
    ];

    await runProviderJobs(
      makeTask(),
      [async (jobs, onProgress) => jobs.updateGames(onProgress)],
      registry,
    );

    expect(progressUpdates()).toStrictEqual([
      { progress: 0.25, message: "Steam: halfway" },
      { progress: 0.75, message: "GOG: halfway" },
    ]);
  });
});

describe("throwOnProviderFailures", () => {
  it("does nothing without failures", () => {
    expect(() => throwOnProviderFailures([])).not.toThrow();
  });

  it("throws an aggregate error naming the failed providers", () => {
    expect(() =>
      throwOnProviderFailures([
        { provider: "steam", error: new Error("steam is down") },
        { provider: "epic", error: new Error("epic is down") },
      ]),
    ).toThrow("Failed for Steam, Epic Games");
  });
});
