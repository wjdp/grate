// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderFilter } from "#shared/providers";
import ProviderSelect from "./ProviderSelect.vue";

type Control = Awaited<ReturnType<typeof mount>>;

const mounted: { unmount: () => void }[] = [];

afterEach(() => {
  // Menus teleport into the body; leaving one open leaks options into the next test.
  while (mounted.length) mounted.pop()!.unmount();
  document.body.innerHTML = "";
});

const mount = async (modelValue: ProviderFilter) => {
  const component = await mountSuspended(ProviderSelect, {
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
  await vi.waitFor(() =>
    expect(component.emitted("update:modelValue")).toBeTruthy(),
  );
};

describe("ProviderSelect", () => {
  it("shows all providers by default", async () => {
    const component = await mount("all");

    expect(component.text()).toContain("All providers");
  });

  it("offers all providers plus every provider", async () => {
    const component = await mount("all");
    await openMenu(component);

    const labels = menuOptions().map((option) => option.textContent?.trim());
    expect(labels).toEqual(["All providers", "Steam", "GOG", "Epic Games"]);
  });

  it("emits the picked provider through the model", async () => {
    const component = await mount("all");
    await openMenu(component);
    await pick(component, "GOG");

    expect(component.emitted("update:modelValue")?.at(-1)).toEqual(["gog"]);
  });
});
