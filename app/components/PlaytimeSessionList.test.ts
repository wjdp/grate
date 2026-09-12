// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UApp from "@nuxt/ui/components/App.vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import type {
  PlaytimeCorrectionJson,
  PlaytimeSessionJson,
} from "#shared/types/PlaytimeSession";
import PlaytimeSessionList from "./PlaytimeSessionList.vue";

// UTooltip needs the TooltipProvider that UApp installs.
const mount = (
  sessions: PlaytimeSessionJson[],
  extraProps: {
    gameId?: number;
    corrections?: PlaytimeCorrectionJson[];
  } = {},
) =>
  mountSuspended(
    defineComponent({
      setup: () => () =>
        h(UApp, null, {
          default: () => h(PlaytimeSessionList, { sessions, ...extraProps }),
        }),
    }),
  );

const makeCorrection = (
  overrides: Partial<PlaytimeCorrectionJson> = {},
): PlaytimeCorrectionJson => ({
  id: 1,
  provider: "gog",
  providerId: 1423049311,
  snapshotId: 42,
  minutes: 70,
  playedFrom: "2020-10-12",
  playedTo: "2020-10-30",
  note: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

const makeSession = (
  overrides: Partial<PlaytimeSessionJson> = {},
): PlaytimeSessionJson => ({
  provider: "gog",
  providerId: 1423049311,
  providerName: "Cyberpunk 2077",
  minutes: 70,
  endedAfter: "2026-08-31T20:39:20.000Z",
  endedBefore: "2026-08-31T20:43:46.000Z",
  estimatedStart: "2026-08-31T19:33:46.000Z",
  estimatedEnd: "2026-08-31T20:43:46.000Z",
  uncertaintyMinutes: 70,
  anchored: false,
  playDay: "2026-08-31",
  calendarMonth: "2026-08",
  calendarYear: 2026,
  snapshotId: null,
  correction: null,
  ...overrides,
});

describe("PlaytimeSessionList", () => {
  it("renders a row per session", async () => {
    const component = await mount([
      makeSession(),
      makeSession({
        provider: "steam",
        minutes: 30,
        endedBefore: "2026-08-29T10:00:00.000Z",
        playDay: "2026-08-29",
      }),
    ]);

    expect(component.findAll("li")).toHaveLength(2);
  });

  it("groups sessions under a heading per play day", async () => {
    const component = await mount([
      makeSession(),
      makeSession({ provider: "steam", minutes: 30 }),
      makeSession({
        provider: "epic",
        minutes: 15,
        playDay: "2026-08-29",
      }),
    ]);

    const headings = component.findAll("h3").map((heading) => heading.text());
    expect(headings).toStrictEqual(["Monday 31 August", "Saturday 29 August"]);
    expect(component.findAll("section")[0]?.findAll("li")).toHaveLength(2);
  });

  it("marks an unanchored session as approximate", async () => {
    const component = await mount([makeSession()]);

    expect(component.text()).toContain("~1h 10m");
  });

  it("states an anchored session exactly", async () => {
    const component = await mount([
      makeSession({ provider: "steam", anchored: true }),
    ]);

    expect(component.text()).toContain("1h 10m");
    expect(component.text()).not.toContain("~");
  });

  it("groups an imprecise session under its calendar month", async () => {
    const component = await mount([
      makeSession({
        playDay: null,
        calendarMonth: "2020-10",
        calendarYear: 2020,
        correction: {
          id: 1,
          playedFrom: "2020-10",
          playedTo: "2020-10",
          note: null,
        },
      }),
    ]);

    expect(
      component.findAll("h3").map((heading) => heading.text()),
    ).toStrictEqual(["October 2020"]);
  });

  it("groups a cross-month session under its calendar year", async () => {
    const component = await mount([
      makeSession({
        playDay: null,
        calendarMonth: null,
        calendarYear: 2020,
        correction: {
          id: 1,
          playedFrom: "2020-10",
          playedTo: "2020-11",
          note: null,
        },
      }),
    ]);

    expect(component.findAll("h3")[0]?.text()).toBe("2020");
  });

  it("shows a corrected badge and the fuzzy window", async () => {
    const component = await mount([
      makeSession({
        playDay: null,
        calendarMonth: "2020-10",
        correction: {
          id: 1,
          playedFrom: "2020-10-12",
          playedTo: "2020-10-30",
          note: null,
        },
      }),
    ]);

    expect(component.text()).toContain("corrected");
    expect(component.text()).toContain("12–30 Oct 2020");
  });

  it("keeps the tilde on an anchored correction with an approximate start", async () => {
    const component = await mount([
      makeSession({
        anchored: true,
        playDay: "2026-09-12",
        correction: {
          id: 1,
          playedFrom: "2026-09-12T00:33~",
          playedTo: "2026-09-12T03:10",
          note: null,
        },
      }),
    ]);

    expect(component.text()).toContain("~");
    expect(component.text()).toContain("00:33");
    expect(component.text()).toContain("03:10");
  });

  it("badges a correction with no snapshot as manual", async () => {
    const component = await mount(
      [
        makeSession({
          anchored: true,
          correction: {
            id: 5,
            playedFrom: "2026-08-31T19:33",
            playedTo: "2026-08-31T20:43",
            note: null,
          },
        }),
      ],
      { corrections: [makeCorrection({ id: 5, snapshotId: null })] },
    );

    expect(component.text()).toContain("manual");
    expect(component.text()).not.toContain("corrected");
  });

  it("offers Correct… only on single-delta sessions", async () => {
    const component = await mount(
      [
        makeSession({ snapshotId: 42 }),
        makeSession({ provider: "steam", minutes: 30, snapshotId: null }),
      ],
      { gameId: 7 },
    );

    const rows = component.findAll("li");
    expect(rows[0]?.text()).toContain("Correct…");
    expect(rows[1]?.text()).not.toContain("Correct…");
  });

  it("hides row actions when no game is given", async () => {
    const component = await mount([makeSession({ snapshotId: 42 })]);

    expect(component.text()).not.toContain("Correct…");
  });

  it("shows the empty state when there are no sessions", async () => {
    const component = await mount([]);

    expect(component.text()).toContain("No sessions yet");
    expect(component.find("li").exists()).toBe(false);
  });
});
