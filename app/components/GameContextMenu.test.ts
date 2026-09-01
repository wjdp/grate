// @vitest-environment nuxt
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h } from "vue";
import type { GameWithProviders } from "#shared/types/Game";
import GameContextMenu from "./GameContextMenu.vue";

const makeGame = (overrides: Partial<GameWithProviders> = {}) =>
  ({
    id: 1,
    name: "Portal 2",
    state: "PLAYING",
    hidden: false,
    steamGames: [],
    gogGames: [],
    epicGames: [],
    ...overrides,
  }) as unknown as GameWithProviders;

const stateRequests: unknown[] = [];
let failStateRequests = false;

registerEndpoint("/api/games/1/state", {
  method: "PATCH",
  handler: async (event) => {
    // The mock request carries the raw JSON body on the node request object.
    const { body } = event.node.req as unknown as { body: string };
    stateRequests.push(JSON.parse(body));
    if (failStateRequests) throw createError({ statusCode: 500 });
    return { game: { id: 1 } };
  },
});

const hiddenRequests: unknown[] = [];

registerEndpoint("/api/games/1/hidden", {
  method: "PATCH",
  handler: async (event) => {
    const { body } = event.node.req as unknown as { body: string };
    hiddenRequests.push(JSON.parse(body));
    return { game: { id: 1 } };
  },
});

const mounted: { unmount: () => void }[] = [];

const itemsOf = (root: ParentNode) =>
  Array.from(
    root.querySelectorAll(
      "[role='menuitem'], [role='menuitemcheckbox'], [data-slot='item']",
    ),
  ) as HTMLElement[];

const findItem = (label: string) =>
  itemsOf(document).find((item) => item.textContent?.trim() === label);

const openMenu = async (game = makeGame()) => {
  const component = await mountSuspended(GameContextMenu, {
    props: { game },
    slots: { default: () => h("a", { href: "/game/1" }, game.name) },
    attachTo: document.body,
  });
  mounted.push(component);
  component
    .get("a")
    .element.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, button: 2 }),
    );
  await vi.waitFor(() => expect(findItem("Set state")).toBeTruthy());
  return component;
};

const openStateSubmenu = async () => {
  const trigger = findItem("Set state")!;
  trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  trigger.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  trigger.click();
  await vi.waitFor(() => expect(findItem("Ignored")).toBeTruthy());
};

const stateItemLabels = () =>
  itemsOf(document)
    .filter((item) => item.getAttribute("role") === "menuitemcheckbox")
    .map((item) => item.textContent?.trim());

beforeEach(async () => {
  // Toasts are queued a tick at a time, so let the previous test's queue drain
  // before clearing it.
  await nextTick();
  stateRequests.length = 0;
  hiddenRequests.length = 0;
  failStateRequests = false;
  useToast().clear();
});

afterEach(() => {
  // The menu portals into the body; a leftover menu leaks into the next test.
  while (mounted.length) mounted.pop()!.unmount();
  document.body.innerHTML = "";
});

describe("GameContextMenu", () => {
  it("names the game and offers the state submenu", async () => {
    await openMenu();

    expect(document.body.textContent).toContain("Portal 2");
    expect(findItem("Set state")).toBeTruthy();
  });

  it("lists every state in group order, marking the current one", async () => {
    await openMenu();
    await openStateSubmenu();

    expect(stateItemLabels()).toEqual(
      gameStateItemGroups.flat().map((item) => item.label),
    );
    const playing = findItem("Playing")!;
    expect(playing.getAttribute("aria-checked")).toBe("true");
    expect(playing.getAttribute("data-disabled")).not.toBeNull();
  });

  it("offers launch actions for a game with a provider row", async () => {
    await openMenu(
      makeGame({
        steamGames: [
          { appId: 620, playtimeForever: 10 },
        ] as unknown as GameWithProviders["steamGames"],
      }),
    );

    expect(findItem("Play")).toBeTruthy();
    expect(findItem("Open store page")).toBeTruthy();
  });

  it("leaves out launch actions for a game with no provider row", async () => {
    await openMenu();

    expect(findItem("Play")).toBeUndefined();
    expect(findItem("Open store page")).toBeUndefined();
  });

  it("patches the state and shows no toast on success", async () => {
    await openMenu();
    await openStateSubmenu();
    findItem("Completed")!.click();
    await vi.waitFor(() => expect(stateRequests).toHaveLength(1));
    await nextTick();

    expect(stateRequests).toEqual([{ state: "COMPLETED" }]);
    expect(useToast().toasts.value).toHaveLength(0);
  });

  it("offers Hide on a visible game", async () => {
    await openMenu();

    const hide = findItem("Hide")!;
    expect(hide).toBeTruthy();
    expect(hide.innerHTML).toContain("i-lucide:eye-off");
    expect(findItem("Unhide")).toBeUndefined();
  });

  it("offers Unhide on a hidden game", async () => {
    await openMenu(makeGame({ hidden: true }));

    const unhide = findItem("Unhide")!;
    expect(unhide).toBeTruthy();
    expect(unhide.innerHTML).toContain("i-lucide:eye");
    expect(findItem("Hide")).toBeUndefined();
  });

  it("patches the hidden flag on selecting Hide", async () => {
    await openMenu();
    findItem("Hide")!.click();

    await vi.waitFor(() => expect(hiddenRequests).toEqual([{ hidden: true }]));
  });

  it("unhides a hidden game", async () => {
    await openMenu(makeGame({ hidden: true }));
    findItem("Unhide")!.click();

    await vi.waitFor(() => expect(hiddenRequests).toEqual([{ hidden: false }]));
  });

  it("toasts and keeps going when the request fails", async () => {
    failStateRequests = true;
    await openMenu();
    await openStateSubmenu();
    findItem("Completed")!.click();

    await vi.waitFor(() =>
      expect(useToast().toasts.value.map((toast) => toast.title)).toContain(
        "Could not set state",
      ),
    );
  });
});
