// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it } from "vitest";
import { getPlaceholderColourCss } from "#shared/artPlaceholder";
import PosterPlaceholder from "./PosterPlaceholder.vue";

describe("PosterPlaceholder", () => {
  it("renders the game title in the display font", async () => {
    const component = await mountSuspended(PosterPlaceholder, {
      props: { name: "Portal 2" },
    });

    const title = component.get("p");
    expect(title.text()).toBe("Portal 2");
    expect(title.classes()).toContain("font-display");
    expect(title.classes()).toContain("line-clamp-4");
  });

  it("paints the background with the colour derived from the name", async () => {
    const component = await mountSuspended(PosterPlaceholder, {
      props: { name: "Portal 2" },
    });

    expect(component.get(".relative").attributes("style")).toContain(
      getPlaceholderColourCss("Portal 2"),
    );
  });

  it("derives a different colour for a different name", async () => {
    const styleFor = async (name: string) =>
      (await mountSuspended(PosterPlaceholder, { props: { name } }))
        .get(".relative")
        .attributes("style");

    expect(await styleFor("Portal 2")).not.toBe(await styleFor("Half-Life 2"));
  });
});
