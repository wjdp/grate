import { and, eq, inArray, or } from "drizzle-orm";
import { FuzzyDateError, resolveFuzzyDateRange } from "#shared/fuzzyDate";
import type {
  CreatePlaytimeCorrectionBody,
  PatchPlaytimeCorrectionBody,
} from "#shared/schemas/playtimeCorrections";
import type { PlaytimeProvider } from "#shared/types/PlaytimeSession";
import { db } from "~~/server/database/client";
import {
  epicGame,
  epicGamePlaytime,
  gogGame,
  gogGamePlaytime,
  type PlaytimeCorrection,
  playtimeCorrection,
  steamGame,
  steamGamePlaytime,
} from "~~/server/database/schema";
import { refreshGameAggregates } from "~~/server/services/gameAggregates";
import {
  type PlaytimeSnapshot,
  snapshotCapacities,
} from "~~/server/services/playtimeTimeline";
import { getSettings } from "~~/server/services/settings";
import { invalidRequest, notFound } from "~~/server/utils/serviceError";

interface ProviderRowRef {
  provider: PlaytimeProvider;
  providerId: number;
}

async function providerRowsOf(gameId: number): Promise<ProviderRowRef[]> {
  const steamRows = db
    .select({ providerId: steamGame.appId })
    .from(steamGame)
    .where(eq(steamGame.gameId, gameId))
    .all();
  const gogRows = db
    .select({ providerId: gogGame.gogId })
    .from(gogGame)
    .where(eq(gogGame.gameId, gameId))
    .all();
  const epicRows = db
    .select({ providerId: epicGame.epicId })
    .from(epicGame)
    .where(eq(epicGame.gameId, gameId))
    .all();
  return [
    ...steamRows.map(({ providerId }) => ({
      provider: "steam" as const,
      providerId,
    })),
    ...gogRows.map(({ providerId }) => ({
      provider: "gog" as const,
      providerId,
    })),
    ...epicRows.map(({ providerId }) => ({
      provider: "epic" as const,
      providerId,
    })),
  ];
}

function snapshotsOf(row: ProviderRowRef): PlaytimeSnapshot[] {
  if (row.provider === "steam") {
    return db
      .select({
        id: steamGamePlaytime.id,
        timestampStart: steamGamePlaytime.timestampStart,
        timestampEnd: steamGamePlaytime.timestampEnd,
        playtimeMinutes: steamGamePlaytime.playtimeForever,
      })
      .from(steamGamePlaytime)
      .where(eq(steamGamePlaytime.steamAppId, row.providerId))
      .all()
      .map((snapshot) => ({
        ...snapshot,
        playtimeMinutes: snapshot.playtimeMinutes ?? 0,
      }));
  }
  if (row.provider === "gog") {
    return db
      .select({
        id: gogGamePlaytime.id,
        timestampStart: gogGamePlaytime.timestampStart,
        timestampEnd: gogGamePlaytime.timestampEnd,
        playtimeMinutes: gogGamePlaytime.playtimeMinutes,
      })
      .from(gogGamePlaytime)
      .where(eq(gogGamePlaytime.gogId, row.providerId))
      .all();
  }
  return db
    .select({
      id: epicGamePlaytime.id,
      timestampStart: epicGamePlaytime.timestampStart,
      timestampEnd: epicGamePlaytime.timestampEnd,
      playtimeMinutes: epicGamePlaytime.playtimeMinutes,
    })
    .from(epicGamePlaytime)
    .where(eq(epicGamePlaytime.epicId, row.providerId))
    .all();
}

function correctionsForRows(rows: ProviderRowRef[]): PlaytimeCorrection[] {
  if (rows.length === 0) return [];
  const byProvider = new Map<PlaytimeProvider, number[]>();
  for (const row of rows) {
    byProvider.set(row.provider, [
      ...(byProvider.get(row.provider) ?? []),
      row.providerId,
    ]);
  }
  const conditions = [...byProvider.entries()].map(([provider, providerIds]) =>
    and(
      eq(playtimeCorrection.provider, provider),
      inArray(playtimeCorrection.providerId, providerIds),
    ),
  );
  return db
    .select()
    .from(playtimeCorrection)
    .where(or(...conditions))
    .all();
}

export async function listPlaytimeCorrections(
  gameId: number,
): Promise<PlaytimeCorrection[]> {
  return correctionsForRows(await providerRowsOf(gameId));
}

export function listPlaytimeCorrectionsForRow(
  row: ProviderRowRef,
): PlaytimeCorrection[] {
  return db
    .select()
    .from(playtimeCorrection)
    .where(
      and(
        eq(playtimeCorrection.provider, row.provider),
        eq(playtimeCorrection.providerId, row.providerId),
      ),
    )
    .all();
}

interface ValidatedCorrection {
  minutes: number;
  playedFrom: string;
  playedTo: string;
}

async function assertPlacementIsPossible(
  row: ProviderRowRef,
  snapshotId: number | null,
  candidate: ValidatedCorrection,
  excludeCorrectionId: number | null,
  now: Date,
) {
  const { effectiveTimezone } = await getSettings();
  let resolved: ReturnType<typeof resolveFuzzyDateRange>;
  try {
    resolved = resolveFuzzyDateRange(
      candidate.playedFrom,
      candidate.playedTo,
      effectiveTimezone,
    );
  } catch (error) {
    if (error instanceof FuzzyDateError) throw invalidRequest(error.message);
    throw error;
  }

  if (snapshotId === null) {
    if (resolved.toEarliest > now) {
      throw invalidRequest("A manual session cannot end in the future");
    }
    return;
  }

  const snapshots = snapshotsOf(row);
  const snapshot = snapshots.find(({ id }) => id === snapshotId);
  if (!snapshot) {
    throw invalidRequest(
      `Snapshot ${snapshotId} does not belong to this provider row`,
    );
  }
  const capacity = snapshotCapacities(snapshots).get(snapshotId);
  if (capacity === undefined) {
    throw invalidRequest(
      `Snapshot ${snapshotId} reported no new playtime, so it has nothing to correct`,
    );
  }
  const alreadyClaimed = listPlaytimeCorrectionsForRow(row)
    .filter(
      (correction) =>
        correction.snapshotId === snapshotId &&
        correction.id !== excludeCorrectionId,
    )
    .reduce((total, correction) => total + correction.minutes, 0);
  if (alreadyClaimed + candidate.minutes > capacity) {
    throw invalidRequest(
      `Corrections for this snapshot may total at most ${capacity} minutes, ${alreadyClaimed} already claimed`,
    );
  }
  if (resolved.toEarliest > snapshot.timestampEnd) {
    throw invalidRequest(
      `Play cannot end after the store observed it at ${snapshot.timestampEnd.toISOString()}`,
    );
  }
}

async function requireProviderRow(
  gameId: number,
  row: ProviderRowRef,
): Promise<ProviderRowRef> {
  const rows = await providerRowsOf(gameId);
  const match = rows.find(
    (candidate) =>
      candidate.provider === row.provider &&
      candidate.providerId === row.providerId,
  );
  if (!match) {
    throw notFound(
      `${row.provider} row ${row.providerId} does not belong to game ${gameId}`,
    );
  }
  return match;
}

async function requireCorrection(
  gameId: number,
  correctionId: number,
): Promise<PlaytimeCorrection> {
  const correction = db
    .select()
    .from(playtimeCorrection)
    .where(eq(playtimeCorrection.id, correctionId))
    .get();
  if (!correction) {
    throw notFound(`Correction ${correctionId} not found`);
  }
  await requireProviderRow(gameId, {
    provider: correction.provider,
    providerId: correction.providerId,
  });
  return correction;
}

export async function createPlaytimeCorrection(
  gameId: number,
  input: CreatePlaytimeCorrectionBody,
  now: Date = new Date(),
): Promise<PlaytimeCorrection> {
  const row = await requireProviderRow(gameId, {
    provider: input.provider,
    providerId: input.providerId,
  });
  await assertPlacementIsPossible(row, input.snapshotId, input, null, now);
  const created = db
    .insert(playtimeCorrection)
    .values({
      provider: row.provider,
      providerId: row.providerId,
      snapshotId: input.snapshotId,
      minutes: input.minutes,
      playedFrom: input.playedFrom,
      playedTo: input.playedTo,
      note: input.note ?? null,
      createdAt: now,
    })
    .returning()
    .get();
  await refreshGameAggregates(gameId);
  return created;
}

export async function updatePlaytimeCorrection(
  gameId: number,
  correctionId: number,
  patch: PatchPlaytimeCorrectionBody,
  now: Date = new Date(),
): Promise<PlaytimeCorrection> {
  const correction = await requireCorrection(gameId, correctionId);
  const row: ProviderRowRef = {
    provider: correction.provider,
    providerId: correction.providerId,
  };
  const updated = {
    snapshotId:
      patch.snapshotId === undefined ? correction.snapshotId : patch.snapshotId,
    minutes: patch.minutes ?? correction.minutes,
    playedFrom: patch.playedFrom ?? correction.playedFrom,
    playedTo: patch.playedTo ?? correction.playedTo,
    note: patch.note === undefined ? correction.note : patch.note,
  };
  await assertPlacementIsPossible(
    row,
    updated.snapshotId,
    updated,
    correction.id,
    now,
  );
  const saved = db
    .update(playtimeCorrection)
    .set(updated)
    .where(eq(playtimeCorrection.id, correctionId))
    .returning()
    .get();
  await refreshGameAggregates(gameId);
  return saved;
}

export async function deletePlaytimeCorrection(
  gameId: number,
  correctionId: number,
): Promise<void> {
  await requireCorrection(gameId, correctionId);
  db.delete(playtimeCorrection)
    .where(eq(playtimeCorrection.id, correctionId))
    .run();
  await refreshGameAggregates(gameId);
}
