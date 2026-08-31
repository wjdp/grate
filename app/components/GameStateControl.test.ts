// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import type { GameState } from "#shared/game-state";
import { afterEach, describe, expect, it } from "vitest";
import GameStateControl from "./GameStateControl.vue";

type Control = Awaited<ReturnType<typeof mount>>;

// Reka's listbox settles selection over several microtask/timer hops.
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

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

const openMenu = async (component: Control) => {
  await component.find("button").trigger("click");
  await settle();
};

const triggerIcon = (component: Control) =>
  component.find("button span.iconify");

const menuOptions = () =>
  Array.from(document.querySelectorAll("[role='option']")) as HTMLElement[];

const pick = async (label: string) => {
  const option = menuOptions().find((item) =>
    item.textContent?.includes(label),
  )!;
  option.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  option.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  option.click();
  await settle();
};

describe("GameStateControl", () => {
  it("shows the unsorted placeholder when no state is set", async () => {
    const component = await mount(null);

    expect(component.text()).toContain("Unsorted");
    expect(triggerIcon(component).classes()).toEqual(
      expect.arrayContaining(["i-lucide:circle-dashed", "text-grey-500"]),
    );
  });

  it("shows the label and hue of the current state", async () => {
    const component = await mount("PLAYING");

    expect(component.text()).toContain("Playing");
    expect(triggerIcon(component).classes()).toEqual(
      expect.arrayContaining(["i-lucide:play", "text-blue-600"]),
    );
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

  it("tints each option icon with its state hue", async () => {
    const component = await mount(null);
    await openMenu(component);

    const completed = menuOptions().find((option) =>
      option.textContent?.includes("Completed"),
    )!;
    const icon = completed.querySelector("span.iconify")!;

    expect(icon.className).toContain("i-lucide:trophy");
    expect(icon.className).toContain("text-green-600");
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
    await pick("Completed");

    expect(component.emitted("update:modelValue")?.at(-1)).toEqual([
      "COMPLETED",
    ]);
    expect(component.emitted("change")?.at(-1)).toEqual(["COMPLETED"]);
  });

  it("emits null when unsorted is picked", async () => {
    const component = await mount("PLAYING");
    await openMenu(component);
    await pick("Unsorted");

    expect(component.emitted("update:modelValue")?.at(-1)).toEqual([null]);
    expect(component.emitted("change")?.at(-1)).toEqual([null]);
  });
});
