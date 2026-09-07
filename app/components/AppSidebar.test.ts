// @vitest-environment nuxt
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it } from "vitest";
import { FakeEventSource } from "~~/test/fakeEventSource";
import AppSidebar from "./AppSidebar.vue";

registerEndpoint("/api/games", () => ({ games: [] }));
registerEndpoint("/api/games/duplicates", () => ({ pairs: [] }));
registerEndpoint("/api/tasks", () => []);

beforeEach(() => {
  FakeEventSource.install();
});

interface LinkWrapper {
  text(): string;
  attributes(name: string): string | undefined;
}

const mount = async (route: string) => {
  const component = await mountSuspended(AppSidebar, { route });
  return component.findAll("a[data-slot='link']") as unknown as LinkWrapper[];
};

const labels = (links: LinkWrapper[]) =>
  links.map((link) => link.text().trim());

const activeLabels = (links: LinkWrapper[]) =>
  labels(links.filter((link) => link.attributes("data-active") !== undefined));

describe("AppSidebar", () => {
  it("renders the library states directly beneath Library", async () => {
    const links = await mount("/games");
    const rows = labels(links);

    expect(rows.slice(0, 2)).toEqual(["Home", "Library"]);
    expect(rows[2]?.startsWith("All")).toBe(true);
    expect(rows.indexOf("Organise")).toBeGreaterThan(
      rows.findIndex((label) => label.startsWith("All")),
    );
  });

  it("omits the library states away from the library", async () => {
    const rows = labels(await mount("/activity"));

    expect(rows.slice(0, 3)).toEqual(["Home", "Library", "Organise"]);
  });

  it("marks only the current route active, with no background elsewhere", async () => {
    const links = await mount("/activity");

    expect(activeLabels(links)).toEqual(["Activity"]);
    for (const link of links) {
      const classes = (link.attributes("class") ?? "").split(/\s+/);
      expect(classes).toContain("data-[active]:before:bg-accented");
      expect(classes).not.toContain("before:bg-accented");
    }
  });

  it("marks Home active only on the index route", async () => {
    expect(activeLabels(await mount("/"))).toEqual(["Home"]);
    expect(activeLabels(await mount("/activity"))).not.toContain("Home");
  });
});
