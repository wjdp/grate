// @vitest-environment nuxt
import { beforeEach, describe, expect, it } from "vitest";
import { useCommandPalette } from "./useCommandPalette";

beforeEach(() => {
  clearNuxtState(["commandPaletteOpen", "commandPalettePanes"], {
    reset: false,
  });
});

describe("useCommandPalette", () => {
  it("starts closed on the root pane", () => {
    const { isOpen, pane, canPopPane } = useCommandPalette();

    expect(isOpen.value).toBe(false);
    expect(pane.value).toEqual({ kind: "root" });
    expect(canPopPane.value).toBe(false);
  });

  it("pushes and pops panes", () => {
    const { pane, canPopPane, pushPane, popPane } = useCommandPalette();

    pushPane({ kind: "game-actions", gameId: 7 });
    expect(pane.value).toEqual({ kind: "game-actions", gameId: 7 });
    expect(canPopPane.value).toBe(true);

    pushPane({ kind: "set-state", gameId: 7 });
    expect(pane.value).toEqual({ kind: "set-state", gameId: 7 });

    popPane();
    expect(pane.value).toEqual({ kind: "game-actions", gameId: 7 });

    popPane();
    expect(pane.value).toEqual({ kind: "root" });
  });

  it("never pops past the root pane", () => {
    const { pane, popPane } = useCommandPalette();

    popPane();

    expect(pane.value).toEqual({ kind: "root" });
  });

  it("resets to the root pane on open", () => {
    const { isOpen, pane, pushPane, open, close } = useCommandPalette();

    pushPane({ kind: "set-state", gameId: 3 });
    close();
    open();

    expect(isOpen.value).toBe(true);
    expect(pane.value).toEqual({ kind: "root" });
  });

  it("opens straight onto a game's actions", () => {
    const { isOpen, pane, canPopPane, openForGame } = useCommandPalette();

    openForGame(12);

    expect(isOpen.value).toBe(true);
    expect(pane.value).toEqual({ kind: "game-actions", gameId: 12 });
    expect(canPopPane.value).toBe(true);
  });
});
