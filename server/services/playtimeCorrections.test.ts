process.env.TZ = "UTC";

import { beforeEach, describe, expect, it } from "vitest";
import {
  createPlaytimeCorrection,
  deletePlaytimeCorrection,
  listPlaytimeCorrections,
  updatePlaytimeCorrection,
} from "~~/server/services/playtimeCorrections";
import { flushDb } from "~~/test/db";
import {
  createGogGame,
  createGogGamePlaytime,
  createSteamGame,
  createSteamGamePlaytime,
} from "~~/test/fixtures/game";

const BASELINE_END = new Date("2026-08-30T14:14:45.000Z");
const DELTA_END = new Date("2026-08-31T20:43:46.000Z");

function gogRowWithDelta() {
  const gog = createGogGame({ name: "Cyberpunk 2077" });
  const baseline = createGogGamePlaytime({
    gogId: gog.gogId,
    timestampStart: null,
    timestampEnd: BASELINE_END,
    playtimeMinutes: 600,
  });
  const delta = createGogGamePlaytime({
    gogId: gog.gogId,
    timestampStart: BASELINE_END,
    timestampEnd: DELTA_END,
    playtimeMinutes: 670,
  });
  return { gog, baseline, delta };
}

function gogCorrection(overrides: Record<string, unknown> = {}) {
  return {
    provider: "gog" as const,
    providerId: 0,
    snapshotId: null as number | null,
    minutes: 70,
    playedFrom: "2026-08-31T19:00",
    playedTo: "2026-08-31T20:10",
    note: null,
    ...overrides,
  };
}

describe("playtime corrections", () => {
  beforeEach(async () => {
    await flushDb();
  });

  it("creates a correction against a GOG delta", async () => {
    const { gog, delta } = gogRowWithDelta();
    const correction = await createPlaytimeCorrection(
      gog.gameId,
      gogCorrection({ providerId: gog.gogId, snapshotId: delta.id }),
    );
    expect(correction).toMatchObject({
      provider: "gog",
      providerId: gog.gogId,
      snapshotId: delta.id,
      minutes: 70,
      note: null,
    });
  });

  it("rejects a correction claiming more than the delta", async () => {
    const { gog, delta } = gogRowWithDelta();
    await expect(
      createPlaytimeCorrection(
        gog.gameId,
        gogCorrection({
          providerId: gog.gogId,
          snapshotId: delta.id,
          minutes: 71,
        }),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("at most 70 minutes"),
    });
  });

  it("lets several corrections split a delta up to its capacity", async () => {
    const { gog, delta } = gogRowWithDelta();
    const first = gogCorrection({
      providerId: gog.gogId,
      snapshotId: delta.id,
      minutes: 40,
    });
    await createPlaytimeCorrection(gog.gameId, first);
    await createPlaytimeCorrection(
      gog.gameId,
      gogCorrection({
        providerId: gog.gogId,
        snapshotId: delta.id,
        minutes: 30,
      }),
    );
    await expect(
      createPlaytimeCorrection(
        gog.gameId,
        gogCorrection({
          providerId: gog.gogId,
          snapshotId: delta.id,
          minutes: 1,
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a provider row belonging to another game", async () => {
    const { gog, delta } = gogRowWithDelta();
    const other = createGogGame({ name: "Blue Prince" });
    await expect(
      createPlaytimeCorrection(
        other.gameId,
        gogCorrection({ providerId: gog.gogId, snapshotId: delta.id }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects a snapshot from another provider row", async () => {
    const { gog } = gogRowWithDelta();
    const other = createGogGame({ name: "Blue Prince" });
    const otherSnapshot = createGogGamePlaytime({
      gogId: other.gogId,
      timestampStart: null,
      timestampEnd: BASELINE_END,
      playtimeMinutes: 50,
    });
    await expect(
      createPlaytimeCorrection(
        gog.gameId,
        gogCorrection({ providerId: gog.gogId, snapshotId: otherSnapshot.id }),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("does not belong to this provider row"),
    });
  });

  it("rejects a snapshot whose total did not move", async () => {
    const { gog } = gogRowWithDelta();
    const unchanged = createGogGamePlaytime({
      gogId: gog.gogId,
      timestampStart: DELTA_END,
      timestampEnd: new Date("2026-09-01T01:00:06.000Z"),
      playtimeMinutes: 670,
    });
    await expect(
      createPlaytimeCorrection(
        gog.gameId,
        gogCorrection({ providerId: gog.gogId, snapshotId: unchanged.id }),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("no new playtime"),
    });
  });

  it("rejects play ending after the store observed the delta", async () => {
    const { gog, delta } = gogRowWithDelta();
    await expect(
      createPlaytimeCorrection(
        gog.gameId,
        gogCorrection({
          providerId: gog.gogId,
          snapshotId: delta.id,
          playedFrom: "2026-09-05T19:00",
          playedTo: "2026-09-05T20:10",
        }),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("after the store observed it"),
    });
  });

  it("rejects a fuzzy range that ends before it starts", async () => {
    const { gog, delta } = gogRowWithDelta();
    await expect(
      createPlaytimeCorrection(
        gog.gameId,
        gogCorrection({
          providerId: gog.gogId,
          snapshotId: delta.id,
          playedFrom: "2026-08-31T20:00",
          playedTo: "2026-08-31T19:00",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("accepts a manual session in the past and rejects one in the future", async () => {
    const { gog } = gogRowWithDelta();
    const now = new Date("2026-09-02T12:00:00.000Z");
    const manual = await createPlaytimeCorrection(
      gog.gameId,
      gogCorrection({ providerId: gog.gogId, snapshotId: null, minutes: 45 }),
      now,
    );
    expect(manual.snapshotId).toBeNull();
    await expect(
      createPlaytimeCorrection(
        gog.gameId,
        gogCorrection({
          providerId: gog.gogId,
          snapshotId: null,
          playedFrom: "2026-09-03T19:00",
          playedTo: "2026-09-03T20:10",
        }),
        now,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("cannot end in the future"),
    });
  });

  it("caps baseline corrections at the pre-history total on the first row", async () => {
    const steam = createSteamGame({ name: "Quantum Break" });
    const baseline = createSteamGamePlaytime({
      steamAppId: steam.appId,
      timestampStart: null,
      timestampEnd: new Date("2020-10-30T00:00:00.000Z"),
      playtimeForever: 1053,
    });
    const correction = await createPlaytimeCorrection(steam.gameId, {
      provider: "steam",
      providerId: steam.appId,
      snapshotId: baseline.id,
      minutes: 1053,
      playedFrom: "2020-10-12",
      playedTo: "2020-10-29",
      note: "Rough memory",
    });
    expect(correction.minutes).toBe(1053);
    await expect(
      createPlaytimeCorrection(steam.gameId, {
        provider: "steam",
        providerId: steam.appId,
        snapshotId: baseline.id,
        minutes: 1,
        playedFrom: "2020-10-12",
        playedTo: "2020-10-29",
        note: null,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("re-validates capacity when a correction is updated", async () => {
    const { gog, delta } = gogRowWithDelta();
    const correction = await createPlaytimeCorrection(
      gog.gameId,
      gogCorrection({
        providerId: gog.gogId,
        snapshotId: delta.id,
        minutes: 40,
      }),
    );
    const updated = await updatePlaytimeCorrection(gog.gameId, correction.id, {
      minutes: 70,
    });
    expect(updated.minutes).toBe(70);
    await expect(
      updatePlaytimeCorrection(gog.gameId, correction.id, { minutes: 71 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("refuses to update a correction belonging to another game", async () => {
    const { gog, delta } = gogRowWithDelta();
    const other = createGogGame({ name: "Blue Prince" });
    const correction = await createPlaytimeCorrection(
      gog.gameId,
      gogCorrection({ providerId: gog.gogId, snapshotId: delta.id }),
    );
    await expect(
      updatePlaytimeCorrection(other.gameId, correction.id, { minutes: 10 }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      deletePlaytimeCorrection(other.gameId, correction.id),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("deletes a correction", async () => {
    const { gog, delta } = gogRowWithDelta();
    const correction = await createPlaytimeCorrection(
      gog.gameId,
      gogCorrection({ providerId: gog.gogId, snapshotId: delta.id }),
    );
    await deletePlaytimeCorrection(gog.gameId, correction.id);
    expect(await listPlaytimeCorrections(gog.gameId)).toEqual([]);
  });

  it("lists only the corrections of the game's own provider rows", async () => {
    const { gog, delta } = gogRowWithDelta();
    const other = gogRowWithDelta();
    await createPlaytimeCorrection(
      gog.gameId,
      gogCorrection({ providerId: gog.gogId, snapshotId: delta.id }),
    );
    await createPlaytimeCorrection(
      other.gog.gameId,
      gogCorrection({
        providerId: other.gog.gogId,
        snapshotId: other.delta.id,
        minutes: 20,
      }),
    );
    const corrections = await listPlaytimeCorrections(gog.gameId);
    expect(corrections.map(({ providerId }) => providerId)).toEqual([
      gog.gogId,
    ]);
  });

  it("returns no corrections for a game with no provider rows", async () => {
    const steam = createSteamGame({ name: "Portal 2" });
    expect(await listPlaytimeCorrections(steam.gameId + 1000)).toEqual([]);
  });
});
