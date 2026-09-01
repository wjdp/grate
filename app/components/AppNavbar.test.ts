// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it, vi } from "vitest";
import AppNavbar from "./AppNavbar.vue";

const open = vi.fn();

mockNuxtImport("useCommandPalette", () => () => ({ open }));

describe("AppNavbar", () => {
  it("shows the logo as the navigation toggle", async () => {
    const component = await mountSuspended(AppNavbar, {
      props: { title: "grate" },
    });

    const toggle = component.get('button[aria-label="Open navigation"]');

    expect(toggle.find("img").exists()).toBe(true);
    expect(component.text()).toContain("grate");
  });

  it("opens the command palette from the search button", async () => {
    const component = await mountSuspended(AppNavbar);

    await component.get('button[aria-label="Search"]').trigger("click");

    expect(open).toHaveBeenCalled();
  });
});
