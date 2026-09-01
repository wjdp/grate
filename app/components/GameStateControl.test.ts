// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "#shared/game-state";
import GameStateControl from "./GameStateControl.vue";

type Control = Awaited<ReturnType<typeof mount>>;

const mounted: { unmount: () => void }[] = [];

afterEach(() => {
  // Menus teleport into the body; leaving one open leaks options into the next test.
  while (mounted.length) mounted.pop()!.unmount();
  document.body.innerHTML = "";
});

const mount = async (modelValue: GameState | null) => {
  const component = await mountSuspended(GameStateControl, {
    props: { modelValue },
    attachTo: document.body,
  });
  mounted.push(component);
  return component;
};

const menuOptions = () =>
  Array.from(document.querySelectorAll("[role='option']")) as HTMLElement[];

// Reka's listbox settles selection over several microtask/timer hops.
const openMenu = async (component: Control) => {
  await component.find("button").trigger("click");
  await vi.waitFor(() => expect(menuOptions().length).toBeGreaterThan(0));
};

const pick = async (component: Control, label: string) => {
  const option = menuOptions().find((item) =>
    item.textContent?.includes(label),
  )!;
  option.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  option.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  option.click();
  await vi.waitFor(() => expect(component.emitted("change")).toBeTruthy());
};

describe("GameStateControl", () => {
  it("shows the unsorted placeholder when no state is set", async () => {
    const component = await mount(null);

    expect(component.text()).toContain("Unsorted");
  });

  it("shows the label of the current state", async () => {
    const component = await mount("PLAYING");

    expect(component.text()).toContain("Playing");
  });

  it("falls back to unsorted for an unknown state", async () => {
    const component = await mount("NOT_A_STATE" as GameState);

    expect(component.text()).toContain("Unsorted");
  });

  it("offers unsorted plus every game state", async () => {
    const component = await mount(null);
    await openMenu(component);

    const labels = menuOptions().map((option) => option.textContent?.trim());
    expect(labels).toHaveLength(10);
    expect(labels[0]).toBe("Unsorted");
    expect(labels).toContain("Backlog");
    expect(labels).toContain("Abandoned");
    expect(labels).toContain("Ignored");
  });

  it("splits the states into five groups", async () => {
    const component = await mount(null);
    await openMenu(component);

    const groups = Array.from(
      document.querySelectorAll("[data-slot='group']"),
    ).map((group) =>
      Array.from(group.querySelectorAll("[role='option']")).map((option) =>
        option.textContent?.trim(),
      ),
    );

    expect(groups).toEqual([
      ["Unsorted"],
      ["Backlog"],
      ["Playing", "Periodic", "Shelved"],
      ["Played", "Completed", "Retired", "Abandoned"],
      ["Ignored"],
    ]);
  });

  it("emits the picked state through the model and change event", async () => {
    const component = await mount(null);
    await openMenu(component);
    await pick(component, "Completed");

    expect(component.emitted("update:modelValue")?.at(-1)).toEqual([
      "COMPLETED",
    ]);
    expect(component.emitted("change")?.at(-1)).toEqual(["COMPLETED"]);
  });

  it("emits null when unsorted is picked", async () => {
    const component = await mount("PLAYING");
    await openMenu(component);
    await pick(component, "Unsorted");

    expect(component.emitted("update:modelValue")?.at(-1)).toEqual([null]);
    expect(component.emitted("change")?.at(-1)).toEqual([null]);
  });
});
