// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it, vi } from "vitest";
import AppPanel from "./AppPanel.vue";

const open = vi.fn();

mockNuxtImport("useCommandPalette", () => () => ({ open }));

describe("AppPanel", () => {
  it("shows the logo as the navigation toggle", async () => {
    const component = await mountSuspended(AppPanel, {
      props: { title: "Library" },
    });

    const toggle = component.get('button[aria-label="Open navigation"]');

    expect(toggle.find("img").exists()).toBe(true);
    expect(component.text()).toContain("grate");
    expect(component.text()).toContain("Library");
  });

  it("opens the command palette from the search button", async () => {
    const component = await mountSuspended(AppPanel);

    await component.get('button[aria-label="Search"]').trigger("click");

    expect(open).toHaveBeenCalled();
  });

  it("renders default slot content in the panel body", async () => {
    const component = await mountSuspended(AppPanel, {
      slots: { default: () => "Body content" },
    });

    expect(component.text()).toContain("Body content");
  });

  it("renders a provided header slot instead of the navbar", async () => {
    const component = await mountSuspended(AppPanel, {
      props: { title: "Library" },
      slots: { header: () => "Custom header" },
    });

    expect(component.text()).toContain("Custom header");
    expect(
      component.find('button[aria-label="Open navigation"]').exists(),
    ).toBe(false);
  });
});
