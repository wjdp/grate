// @vitest-environment nuxt
import { mockNuxtImport, registerEndpoint } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameWithProviders } from "#shared/types/Game";
import { useSetGameState } from "./useSetGameState";

const makeGame = (id: number, name: string): GameWithProviders =>
  ({
    id,
    name,
    state: null,
    hidden: false,
    steamGames: [],
    gogGames: [],
    epicGames: [],
  }) as unknown as GameWithProviders;

const stateRequests: unknown[] = [];
let gate = Promise.resolve();

registerEndpoint("/api/games/1/state", {
  method: "PATCH",
  handler: async (event) => {
    // The mock request carries the raw JSON body on the node request object.
    const { body } = event.node.req as unknown as { body: string };
    stateRequests.push(JSON.parse(body));
    await gate;
    return { game: { id: 1 } };
  },
});

registerEndpoint("/api/games/2/state", {
  method: "PATCH",
  handler: () => {
    throw createError({ statusCode: 500, statusMessage: "Nope" });
  },
});

const cache = () =>
  useNuxtData<{ games: GameWithProviders[] }>("games").data.value;

const { refreshNuxtDataMock } = vi.hoisted(() => ({
  refreshNuxtDataMock: vi.fn(),
}));
mockNuxtImport("refreshNuxtData", () => refreshNuxtDataMock);

beforeEach(() => {
  stateRequests.length = 0;
  gate = Promise.resolve();
  refreshNuxtDataMock.mockClear();
  useToast().clear();
  useNuxtData<{ games: GameWithProviders[] }>("games").data.value = {
    games: [makeGame(1, "Portal 2"), makeGame(2, "Baldur's Gate")],
  };
});

describe("useSetGameState", () => {
  it("patches the cached library before the request resolves", async () => {
    let release: () => void = () => {};
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const setGameState = useSetGameState();

    const pending = setGameState(makeGame(1, "Portal 2"), "COMPLETED");
    expect(cache()?.games[0]?.state).toBe("COMPLETED");
    expect(cache()?.games[1]?.state).toBe(null);

    release();
    await pending;

    expect(stateRequests).toEqual([{ state: "COMPLETED" }]);
    expect(cache()?.games[0]?.state).toBe("COMPLETED");
  });

  it("replaces the array and the changed game rather than mutating them", async () => {
    const before = cache();
    const setGameState = useSetGameState();

    await setGameState(makeGame(1, "Portal 2"), "PLAYING");

    expect(cache()).not.toBe(before);
    expect(cache()?.games).not.toBe(before?.games);
    expect(cache()?.games[0]).not.toBe(before?.games[0]);
    expect(cache()?.games[1]).toBe(before?.games[1]);
  });

  it("shows no toast and does not refresh on success", async () => {
    const setGameState = useSetGameState();

    await setGameState(makeGame(1, "Portal 2"), "PLAYING");
    await nextTick();

    expect(useToast().toasts.value).toHaveLength(0);
    expect(refreshNuxtDataMock).not.toHaveBeenCalled();
  });

  it("reverts the cache and toasts when the request fails", async () => {
    const before = cache();
    const setGameState = useSetGameState();

    await setGameState(makeGame(2, "Baldur's Gate"), "PLAYING");
    await nextTick();

    expect(cache()).toBe(before);
    expect(useToast().toasts.value).toHaveLength(1);
    expect(useToast().toasts.value[0]?.title).toBe("Could not set state");
  });
});
