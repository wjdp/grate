// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it } from "vitest";
import HistoryGrid from "./HistoryGrid.vue";

describe("HistoryGrid", () => {
  it("renders one cell per day, offset by the weekday the year starts on", async () => {
    // 2021-01-01 was a Friday, so the first column carries five blank cells.
    const component = await mountSuspended(HistoryGrid, {
      props: { year: 2021, days: [] },
    });

    const cells = component.findAll(".h-4.rounded");
    expect(cells).toHaveLength(5 + 365);
    expect(cells.slice(0, 5).every((cell) => cell.classes("opacity-0"))).toBe(
      true,
    );
  });

  it("adds a leap day", async () => {
    const component = await mountSuspended(HistoryGrid, {
      props: { year: 2024, days: [] },
    });

    // 2024-01-01 was a Monday.
    expect(component.findAll(".h-4.rounded")).toHaveLength(1 + 366);
  });

  it("titles each day with its date and playtime", async () => {
    const component = await mountSuspended(HistoryGrid, {
      props: {
        year: 2021,
        days: [{ date: "2021-01-01", minutes: 90 }],
      },
    });

    const titles = component
      .findAll(".h-4.rounded")
      .map((cell) => cell.attributes("title"));
    expect(titles).toContain("2021-01-01: 1h 30m");
    expect(titles).toContain("2021-01-02: nothing");
  });

  it("buckets playtime into the intensity scale", async () => {
    const component = await mountSuspended(HistoryGrid, {
      props: {
        year: 2021,
        days: [
          { date: "2021-01-01", minutes: 0 },
          { date: "2021-01-02", minutes: 59 },
          { date: "2021-01-03", minutes: 60 },
          { date: "2021-01-04", minutes: 180 },
          { date: "2021-01-05", minutes: 360 },
        ],
      },
    });

    const classesFor = (date: string) =>
      component
        .findAll(".h-4.rounded")
        .find((cell) => cell.attributes("title")?.startsWith(date))!
        .classes();

    expect(classesFor("2021-01-01")).toContain("bg-grey-300");
    expect(classesFor("2021-01-02")).toContain("bg-[oklch(0.90_0.100_90)]");
    expect(classesFor("2021-01-03")).toContain("bg-[oklch(0.80_0.140_84)]");
    expect(classesFor("2021-01-04")).toContain("bg-[oklch(0.70_0.150_78)]");
    expect(classesFor("2021-01-05")).toContain("bg-[oklch(0.60_0.135_72)]");
  });

  it("labels the months across the top", async () => {
    const component = await mountSuspended(HistoryGrid, {
      props: { year: 2021, days: [] },
    });

    const labels = component
      .findAll("span.absolute")
      .map((label) => label.text());
    expect(labels).toHaveLength(12);
    expect(labels[0]).toBe("Jan");
    expect(labels[11]).toBe("Dec");
  });
});
