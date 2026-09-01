// @vitest-environment nuxt
import { mockNuxtImport, registerEndpoint } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameWithProviders } from "#shared/types/Game";
import { useSetGameHidden } from "./useSetGameHidden";

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

const hiddenRequests: unknown[] = [];
let gate = Promise.resolve();

registerEndpoint("/api/games/1/hidden", {
  method: "PATCH",
  handler: async (event) => {
    // The mock request carries the raw JSON body on the node request object.
    const { body } = event.node.req as unknown as { body: string };
    hiddenRequests.push(JSON.parse(body));
    await gate;
    return { game: { id: 1 } };
  },
});

registerEndpoint("/api/games/2/hidden", {
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

const toasts = () => useToast().toasts.value;

beforeEach(() => {
  hiddenRequests.length = 0;
  gate = Promise.resolve();
  refreshNuxtDataMock.mockClear();
  useToast().clear();
  useNuxtData<{ games: GameWithProviders[] }>("games").data.value = {
    games: [makeGame(1, "Portal 2"), makeGame(2, "Baldur's Gate")],
  };
});

describe("useSetGameHidden", () => {
  it("patches the cached library before the request resolves", async () => {
    let release: () => void = () => {};
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const setGameHidden = useSetGameHidden();

    const pending = setGameHidden(makeGame(1, "Portal 2"), true);
    expect(cache()?.games[0]?.hidden).toBe(true);
    expect(cache()?.games[1]?.hidden).toBe(false);

    release();
    await pending;

    expect(hiddenRequests).toEqual([{ hidden: true }]);
    expect(cache()?.games[0]?.hidden).toBe(true);
  });

  it("replaces the array and the changed game rather than mutating them", async () => {
    const before = cache();
    const setGameHidden = useSetGameHidden();

    await setGameHidden(makeGame(1, "Portal 2"), true);

    expect(cache()).not.toBe(before);
    expect(cache()?.games).not.toBe(before?.games);
    expect(cache()?.games[0]).not.toBe(before?.games[0]);
    expect(cache()?.games[1]).toBe(before?.games[1]);
  });

  it("confirms the change with a toast without refreshing", async () => {
    const setGameHidden = useSetGameHidden();

    await setGameHidden(makeGame(1, "Portal 2"), true);
    await nextTick();

    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]?.title).toBe("Hidden from library");
    expect(toasts()[0]?.icon).toBe("i-lucide-eye-off");
    expect(refreshNuxtDataMock).not.toHaveBeenCalled();
  });

  it("names unhiding in its own toast", async () => {
    const setGameHidden = useSetGameHidden();

    await setGameHidden(makeGame(1, "Portal 2"), false);
    await nextTick();

    expect(toasts()[0]?.title).toBe("Shown in library");
    expect(toasts()[0]?.icon).toBe("i-lucide-eye");
  });

  it("reverts the cache and toasts when the request fails", async () => {
    const before = cache();
    const setGameHidden = useSetGameHidden();

    await setGameHidden(makeGame(2, "Baldur's Gate"), true);
    await nextTick();

    expect(cache()).toBe(before);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]?.title).toBe("Could not hide game");
  });

  it("names unhiding in its failure toast", async () => {
    const setGameHidden = useSetGameHidden();

    await setGameHidden(makeGame(2, "Baldur's Gate"), false);
    await nextTick();

    expect(toasts()[0]?.title).toBe("Could not unhide game");
  });
});
