// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppTabBar from "./AppTabBar.vue";

const toggleSidebar = vi.fn();

vi.mock("@nuxt/ui/utils/dashboard", () => ({
  useDashboard: () => ({ toggleSidebar }),
}));

describe("AppTabBar", () => {
  beforeEach(() => {
    toggleSidebar.mockClear();
  });

  it("renders five tabs", async () => {
    const component = await mountSuspended(AppTabBar);

    expect(component.findAll("a")).toHaveLength(4);
    expect(component.text()).toContain("Home");
    expect(component.text()).toContain("Library");
    expect(component.text()).toContain("Organise");
    expect(component.text()).toContain("Activity");
    expect(component.text()).toContain("More");
  });

  it("marks the tab matching the route as active", async () => {
    const component = await mountSuspended(AppTabBar, { route: "/activity" });

    const active = component.findAll('a[aria-current="page"]');

    expect(active).toHaveLength(1);
    expect(active[0]?.text()).toContain("Activity");
    expect(active[0]?.classes()).toContain("text-primary");
  });

  it("marks Library active on a game page", async () => {
    const component = await mountSuspended(AppTabBar, { route: "/game/1" });

    expect(component.get('a[aria-current="page"]').text()).toContain("Library");
  });

  it("opens the drawer from the More tab", async () => {
    const component = await mountSuspended(AppTabBar);

    await component.get('button[aria-label="More"]').trigger("click");

    expect(toggleSidebar).toHaveBeenCalled();
  });
});
