import { describe, expect, it } from "vitest";
import type {
  PlaytimeProviderRow,
  PlaytimeSnapshot,
} from "~~/lib/playtimeTimeline";
import { deriveSessions, inferredLastPlayedAt } from "~~/lib/playtimeTimeline";

const cyberpunkRow: PlaytimeProviderRow = {
  provider: "gog",
  providerId: 1423049311,
  providerName: "Cyberpunk 2077",
};

const steamRow: PlaytimeProviderRow = {
  provider: "steam",
  providerId: 620,
  providerName: "Portal 2",
};

const cyberpunkSnapshots: PlaytimeSnapshot[] = [
  {
    timestampStart: null,
    timestampEnd: new Date("2026-08-30T14:14:45Z"),
    playtimeMinutes: 11336,
  },
  {
    timestampStart: new Date("2026-08-30T14:14:45Z"),
    timestampEnd: new Date("2026-08-31T20:39:20Z"),
    playtimeMinutes: 11336,
  },
  {
    timestampStart: new Date("2026-08-31T20:39:20Z"),
    timestampEnd: new Date("2026-08-31T20:43:46Z"),
    playtimeMinutes: 11406,
  },
  {
    timestampStart: new Date("2026-08-31T20:43:46Z"),
    timestampEnd: new Date("2026-09-01T01:00:06Z"),
    playtimeMinutes: 11406,
  },
];

// Rows 51790-51810 of `SteamGamePlaytime` for Factorio: one 18-hour sitting
// flushed hourly, each flush advancing `rTimeLastPlayed` by the delta.
const factorioRow: PlaytimeProviderRow = {
  provider: "steam",
  providerId: 427520,
  providerName: "Factorio",
};

const factorioSnapshots: PlaytimeSnapshot[] = (
  [
    ["2026-06-12T01:00:01Z", "2026-06-12T02:00:02Z", 16323, 1781229425],
    ["2026-06-12T02:00:02Z", "2026-06-12T19:00:01Z", 16323, 1781229425],
    ["2026-06-12T19:00:01Z", "2026-06-12T20:00:01Z", 16353, 1781293293],
    ["2026-06-12T20:00:01Z", "2026-06-12T21:00:02Z", 16413, 1781296893],
    ["2026-06-12T21:00:02Z", "2026-06-12T22:00:02Z", 16473, 1781300493],
    ["2026-06-12T22:00:02Z", "2026-06-12T23:00:01Z", 16533, 1781304094],
    ["2026-06-12T23:00:01Z", "2026-06-13T00:00:03Z", 16593, 1781307694],
    ["2026-06-13T00:00:03Z", "2026-06-13T01:00:01Z", 16653, 1781311294],
    ["2026-06-13T01:00:01Z", "2026-06-13T02:00:01Z", 16713, 1781314894],
    ["2026-06-13T02:00:01Z", "2026-06-13T03:00:01Z", 16773, 1781318494],
    ["2026-06-13T03:00:01Z", "2026-06-13T04:00:01Z", 16833, 1781322095],
    ["2026-06-13T04:00:01Z", "2026-06-13T05:00:02Z", 16893, 1781325695],
    ["2026-06-13T05:00:02Z", "2026-06-13T06:00:01Z", 16953, 1781329295],
    ["2026-06-13T06:00:01Z", "2026-06-13T07:00:01Z", 17013, 1781332895],
    ["2026-06-13T07:00:01Z", "2026-06-13T08:00:01Z", 17073, 1781336495],
    ["2026-06-13T08:00:01Z", "2026-06-13T09:00:01Z", 17133, 1781340095],
    ["2026-06-13T09:00:01Z", "2026-06-13T10:00:01Z", 17193, 1781343695],
    ["2026-06-13T10:00:01Z", "2026-06-13T11:00:02Z", 17253, 1781347295],
    ["2026-06-13T11:00:02Z", "2026-06-13T12:00:01Z", 17313, 1781350895],
    ["2026-06-13T12:00:01Z", "2026-06-13T13:00:01Z", 17373, 1781354495],
    ["2026-06-13T13:00:01Z", "2026-06-13T14:00:01Z", 17399, 1781356068],
  ] as const
).map(([start, end, playtimeMinutes, rTimeLastPlayed]) => ({
  timestampStart: new Date(start),
  timestampEnd: new Date(end),
  playtimeMinutes,
  rTimeLastPlayed,
}));

describe("deriveSessions", () => {
  it("returns nothing for no snapshots", () => {
    expect(deriveSessions([], cyberpunkRow)).toEqual([]);
  });

  it("returns nothing for a single snapshot as a delta needs two", () => {
    expect(
      deriveSessions([cyberpunkSnapshots[0] as PlaytimeSnapshot], cyberpunkRow),
    ).toEqual([]);
  });

  it("emits nothing for the grounding baseline pair, whose partner repeats the same pre-history total", () => {
    const sessions = deriveSessions(
      cyberpunkSnapshots.slice(0, 2),
      cyberpunkRow,
    );
    expect(sessions).toEqual([]);
  });

  it("emits a session when the first sync after the baseline shows a higher total, bounded by the baseline end", () => {
    const sessions = deriveSessions(
      [
        {
          timestampStart: null,
          timestampEnd: new Date("2026-08-30T14:14:45Z"),
          playtimeMinutes: 11336,
        },
        {
          timestampStart: null,
          timestampEnd: new Date("2026-08-30T15:14:45Z"),
          playtimeMinutes: 11366,
        },
      ],
      cyberpunkRow,
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.minutes).toBe(30);
    expect(sessions[0]?.endedAfter).toEqual(new Date("2026-08-30T14:14:45Z"));
    expect(sessions[0]?.endedBefore).toEqual(new Date("2026-08-30T15:14:45Z"));
  });

  it("derives exactly one 70 minute session from the Cyberpunk 2077 rows", () => {
    const sessions = deriveSessions(cyberpunkSnapshots, cyberpunkRow);
    expect(sessions).toEqual([
      {
        provider: "gog",
        providerId: 1423049311,
        providerName: "Cyberpunk 2077",
        minutes: 70,
        endedAfter: new Date("2026-08-31T20:39:20Z"),
        endedBefore: new Date("2026-08-31T20:43:46Z"),
        estimatedStart: new Date("2026-08-31T19:33:46Z"),
        estimatedEnd: new Date("2026-08-31T20:43:46Z"),
        uncertaintyMinutes: 70,
        anchored: false,
      },
    ]);
  });

  it("ignores no-change extension rows that only push timestampEnd forward", () => {
    const extended: PlaytimeSnapshot[] = [
      ...cyberpunkSnapshots.slice(0, 3),
      {
        timestampStart: new Date("2026-08-31T20:43:46Z"),
        timestampEnd: new Date("2026-09-03T01:00:06Z"),
        playtimeMinutes: 11406,
      },
    ];
    expect(deriveSessions(extended, cyberpunkRow)).toHaveLength(1);
  });

  it("emits one session per positive delta, ordered by end bound", () => {
    const sessions = deriveSessions(
      [
        ...cyberpunkSnapshots,
        {
          timestampStart: new Date("2026-09-01T01:00:06Z"),
          timestampEnd: new Date("2026-09-01T02:00:06Z"),
          playtimeMinutes: 11436,
        },
        {
          timestampStart: new Date("2026-09-01T02:00:06Z"),
          timestampEnd: new Date("2026-09-01T03:00:06Z"),
          playtimeMinutes: 11466,
        },
      ],
      cyberpunkRow,
    );
    expect(sessions.map((session) => session.minutes)).toEqual([70, 30, 30]);
    expect(sessions.map((session) => session.endedBefore)).toEqual([
      new Date("2026-08-31T20:43:46Z"),
      new Date("2026-09-01T02:00:06Z"),
      new Date("2026-09-01T03:00:06Z"),
    ]);
  });

  it("takes uncertainty from the window when a wide downtime window swallows the play", () => {
    const sessions = deriveSessions(
      [
        {
          timestampStart: new Date("2026-08-28T00:00:00Z"),
          timestampEnd: new Date("2026-08-28T01:00:00Z"),
          playtimeMinutes: 100,
        },
        {
          timestampStart: new Date("2026-08-28T01:00:00Z"),
          timestampEnd: new Date("2026-08-31T01:00:00Z"),
          playtimeMinutes: 220,
        },
      ],
      cyberpunkRow,
    );
    expect(sessions[0]?.minutes).toBe(120);
    expect(sessions[0]?.uncertaintyMinutes).toBe(3 * 24 * 60);
    expect(sessions[0]?.estimatedStart).toEqual(
      new Date("2026-08-30T23:00:00Z"),
    );
    expect(sessions[0]?.anchored).toBe(false);
  });

  it("anchors a Steam session's end on rTimeLastPlayed when it changes", () => {
    const flushedAt = new Date("2026-08-31T18:00:00Z");
    const sessions = deriveSessions(
      [
        {
          timestampStart: new Date("2026-08-31T17:00:00Z"),
          timestampEnd: new Date("2026-08-31T18:00:00Z"),
          playtimeMinutes: 500,
          rTimeLastPlayed: 1756000000,
        },
        {
          timestampStart: new Date("2026-08-31T18:00:00Z"),
          timestampEnd: new Date("2026-08-31T19:00:00Z"),
          playtimeMinutes: 545,
          rTimeLastPlayed: flushedAt.getTime() / 1000,
        },
      ],
      steamRow,
    );
    expect(sessions[0]?.anchored).toBe(true);
    expect(sessions[0]?.estimatedEnd).toEqual(flushedAt);
    expect(sessions[0]?.estimatedStart).toEqual(
      new Date("2026-08-31T17:15:00Z"),
    );
    expect(sessions[0]?.uncertaintyMinutes).toBe(0);
  });

  it("merges the hourly anchored deltas of one Factorio sitting into a single session", () => {
    const sessions = deriveSessions(factorioSnapshots, factorioRow);
    expect(sessions).toEqual([
      {
        ...factorioRow,
        minutes: 1076,
        endedAfter: new Date("2026-06-13T13:00:01Z"),
        endedBefore: new Date("2026-06-13T14:00:01Z"),
        estimatedStart: new Date("2026-06-12T19:11:33Z"),
        estimatedEnd: new Date("2026-06-13T13:07:48Z"),
        uncertaintyMinutes: 0,
        anchored: true,
      },
    ]);
  });

  it("keeps anchored sessions separated by more than the merge tolerance apart", () => {
    const sessions = deriveSessions(
      [
        {
          timestampStart: new Date("2026-06-14T10:00:00Z"),
          timestampEnd: new Date("2026-06-14T11:00:00Z"),
          playtimeMinutes: 100,
          rTimeLastPlayed: new Date("2026-06-14T10:30:00Z").getTime() / 1000,
        },
        {
          timestampStart: new Date("2026-06-14T11:00:00Z"),
          timestampEnd: new Date("2026-06-14T12:00:00Z"),
          playtimeMinutes: 130,
          rTimeLastPlayed: new Date("2026-06-14T11:30:00Z").getTime() / 1000,
        },
        {
          timestampStart: new Date("2026-06-14T12:00:00Z"),
          timestampEnd: new Date("2026-06-14T13:00:00Z"),
          playtimeMinutes: 150,
          rTimeLastPlayed: new Date("2026-06-14T12:50:00Z").getTime() / 1000,
        },
      ],
      steamRow,
    );
    expect(sessions.map((session) => session.minutes)).toEqual([30, 20]);
    expect(sessions.map((session) => session.estimatedEnd)).toEqual([
      new Date("2026-06-14T11:30:00Z"),
      new Date("2026-06-14T12:50:00Z"),
    ]);
  });

  it("never merges an unanchored delta into the anchored session before it", () => {
    const sessions = deriveSessions(
      [
        {
          timestampStart: new Date("2026-06-14T10:00:00Z"),
          timestampEnd: new Date("2026-06-14T11:00:00Z"),
          playtimeMinutes: 100,
          rTimeLastPlayed: new Date("2026-06-14T10:30:00Z").getTime() / 1000,
        },
        {
          timestampStart: new Date("2026-06-14T11:00:00Z"),
          timestampEnd: new Date("2026-06-14T12:00:00Z"),
          playtimeMinutes: 130,
          rTimeLastPlayed: new Date("2026-06-14T11:30:00Z").getTime() / 1000,
        },
        {
          timestampStart: new Date("2026-06-14T12:00:00Z"),
          timestampEnd: new Date("2026-06-14T13:00:00Z"),
          playtimeMinutes: 160,
          rTimeLastPlayed: new Date("2026-06-14T11:30:00Z").getTime() / 1000,
        },
      ],
      steamRow,
    );
    expect(sessions.map((session) => session.anchored)).toEqual([true, false]);
    expect(sessions.map((session) => session.minutes)).toEqual([30, 30]);
  });

  it("treats a Steam continuation delta with unchanged rTimeLastPlayed as unanchored and bounded by its window, since Steam counts playtime live", () => {
    const flushedAt = new Date("2026-08-31T18:00:00Z");
    const sessions = deriveSessions(
      [
        {
          timestampStart: new Date("2026-08-31T17:00:00Z"),
          timestampEnd: new Date("2026-08-31T18:00:00Z"),
          playtimeMinutes: 500,
          rTimeLastPlayed: 1756000000,
        },
        {
          timestampStart: new Date("2026-08-31T18:00:00Z"),
          timestampEnd: new Date("2026-08-31T19:00:00Z"),
          playtimeMinutes: 545,
          rTimeLastPlayed: flushedAt.getTime() / 1000,
        },
        {
          timestampStart: new Date("2026-08-31T19:00:00Z"),
          timestampEnd: new Date("2026-08-31T20:00:00Z"),
          playtimeMinutes: 605,
          rTimeLastPlayed: flushedAt.getTime() / 1000,
        },
      ],
      steamRow,
    );
    const continuation = sessions[1];
    expect(continuation?.anchored).toBe(false);
    expect(continuation?.minutes).toBe(60);
    expect(continuation?.estimatedStart).toEqual(
      new Date("2026-08-31T19:00:00Z"),
    );
    expect(continuation?.estimatedEnd).toEqual(
      new Date("2026-08-31T20:00:00Z"),
    );
    expect(continuation?.uncertaintyMinutes).toBe(60);
  });

  it("orders unsorted snapshots before deriving", () => {
    const shuffled = [
      cyberpunkSnapshots[2],
      cyberpunkSnapshots[0],
      cyberpunkSnapshots[3],
      cyberpunkSnapshots[1],
    ] as PlaytimeSnapshot[];
    expect(deriveSessions(shuffled, cyberpunkRow)).toEqual(
      deriveSessions(cyberpunkSnapshots, cyberpunkRow),
    );
  });
});

describe("inferredLastPlayedAt", () => {
  it("returns null when no session can be derived", () => {
    expect(inferredLastPlayedAt(cyberpunkSnapshots.slice(0, 2))).toBeNull();
    expect(inferredLastPlayedAt([])).toBeNull();
  });

  it("returns the end bound of the latest derived session", () => {
    expect(inferredLastPlayedAt(cyberpunkSnapshots)).toEqual(
      new Date("2026-08-31T20:43:46Z"),
    );
  });
});
