import { eq } from "drizzle-orm";
import type { PlayDaySettings } from "#shared/playDay";
import type {
  ActivityYear,
  DailyPlaytime,
  MonthlyPlaytime,
} from "#shared/types/Activity";
import type { PlaytimeProvider } from "#shared/types/PlaytimeSession";
import { db } from "~~/server/database/client";
import {
  epicGame,
  epicGamePlaytime,
  game,
  gogGame,
  gogGamePlaytime,
  playtimeCorrection,
  steamGame,
  steamGamePlaytime,
} from "~~/server/database/schema";
import {
  type CorrectionInput,
  deriveTimeline,
  type PlaytimeProviderRow,
  type PlaytimeSnapshot,
} from "~~/server/services/playtimeTimeline";
import { getPlayDaySettings } from "~~/server/services/settings";

interface ProviderRowTimeline {
  row: PlaytimeProviderRow;
  snapshots: PlaytimeSnapshot[];
  corrections: CorrectionInput[];
}

function rowKey(provider: PlaytimeProvider, providerId: number) {
  return `${provider}:${providerId}`;
}

function groupedByRow<T>(
  records: T[],
  keyOf: (record: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    const key = keyOf(record);
    const existing = grouped.get(key);
    if (existing) existing.push(record);
    else grouped.set(key, [record]);
  }
  return grouped;
}

function visibleProviderRows(): PlaytimeProviderRow[] {
  const steamRows = db
    .select({ providerId: steamGame.appId, providerName: steamGame.name })
    .from(steamGame)
    .innerJoin(game, eq(steamGame.gameId, game.id))
    .where(eq(game.hidden, false))
    .all();
  const gogRows = db
    .select({ providerId: gogGame.gogId, providerName: gogGame.name })
    .from(gogGame)
    .innerJoin(game, eq(gogGame.gameId, game.id))
    .where(eq(game.hidden, false))
    .all();
  const epicRows = db
    .select({ providerId: epicGame.epicId, providerName: epicGame.name })
    .from(epicGame)
    .innerJoin(game, eq(epicGame.gameId, game.id))
    .where(eq(game.hidden, false))
    .all();
  return [
    ...steamRows.map((row) => ({ ...row, provider: "steam" as const })),
    ...gogRows.map((row) => ({ ...row, provider: "gog" as const })),
    ...epicRows.map((row) => ({ ...row, provider: "epic" as const })),
  ];
}

function snapshotsByRow(): Map<string, PlaytimeSnapshot[]> {
  const steamRecords = db
    .select({
      id: steamGamePlaytime.id,
      steamAppId: steamGamePlaytime.steamAppId,
      timestampStart: steamGamePlaytime.timestampStart,
      timestampEnd: steamGamePlaytime.timestampEnd,
      playtimeMinutes: steamGamePlaytime.playtimeForever,
      rTimeLastPlayed: steamGamePlaytime.rTimeLastPlayed,
      playtimeDisconnected: steamGamePlaytime.playtimeDisconnected,
    })
    .from(steamGamePlaytime)
    .all();
  const gogRecords = db
    .select({
      id: gogGamePlaytime.id,
      gogId: gogGamePlaytime.gogId,
      timestampStart: gogGamePlaytime.timestampStart,
      timestampEnd: gogGamePlaytime.timestampEnd,
      playtimeMinutes: gogGamePlaytime.playtimeMinutes,
    })
    .from(gogGamePlaytime)
    .all();
  const epicRecords = db
    .select({
      id: epicGamePlaytime.id,
      epicId: epicGamePlaytime.epicId,
      timestampStart: epicGamePlaytime.timestampStart,
      timestampEnd: epicGamePlaytime.timestampEnd,
      playtimeMinutes: epicGamePlaytime.playtimeMinutes,
    })
    .from(epicGamePlaytime)
    .all();

  return groupedByRow<PlaytimeSnapshot & { key: string }>(
    [
      ...steamRecords.map(({ steamAppId, ...record }) => ({
        ...record,
        playtimeMinutes: record.playtimeMinutes ?? 0,
        key: rowKey("steam", steamAppId),
      })),
      ...gogRecords.map(({ gogId, ...record }) => ({
        ...record,
        key: rowKey("gog", gogId),
      })),
      ...epicRecords.map(({ epicId, ...record }) => ({
        ...record,
        key: rowKey("epic", epicId),
      })),
    ],
    (record) => record.key,
  );
}

function correctionsByRow(): Map<string, CorrectionInput[]> {
  const corrections = db
    .select({
      id: playtimeCorrection.id,
      provider: playtimeCorrection.provider,
      providerId: playtimeCorrection.providerId,
      snapshotId: playtimeCorrection.snapshotId,
      minutes: playtimeCorrection.minutes,
      playedFrom: playtimeCorrection.playedFrom,
      playedTo: playtimeCorrection.playedTo,
      note: playtimeCorrection.note,
    })
    .from(playtimeCorrection)
    .all();
  return groupedByRow(corrections, (correction) =>
    rowKey(correction.provider, correction.providerId),
  );
}

function visibleTimelines(): ProviderRowTimeline[] {
  const snapshots = snapshotsByRow();
  const corrections = correctionsByRow();
  return visibleProviderRows().map((row) => {
    const key = rowKey(row.provider, row.providerId);
    return {
      row,
      snapshots: snapshots.get(key) ?? [],
      corrections: corrections.get(key) ?? [],
    };
  });
}

function addMinutes(totals: Map<string, number>, key: string, minutes: number) {
  totals.set(key, (totals.get(key) ?? 0) + minutes);
}

export async function getDailyPlaytime(
  year: number,
  settings?: PlayDaySettings,
): Promise<ActivityYear> {
  const playDaySettings = settings ?? (await getPlayDaySettings());
  const minutesByDay = new Map<string, number>();
  const minutesByMonth = new Map<string, number>();
  let yearOnly = 0;

  for (const { row, snapshots, corrections } of visibleTimelines()) {
    const { sessions } = deriveTimeline(
      snapshots,
      row,
      corrections,
      playDaySettings,
    );
    for (const session of sessions) {
      const minutes = Math.round(session.minutes);
      if (session.playDay) {
        if (session.playDay.startsWith(`${year}-`)) {
          addMinutes(minutesByDay, session.playDay, minutes);
        }
        continue;
      }
      if (session.calendarMonth) {
        if (session.calendarMonth.startsWith(`${year}-`)) {
          addMinutes(minutesByMonth, session.calendarMonth, minutes);
        }
        continue;
      }
      if (session.calendarYear === year) {
        yearOnly += minutes;
      }
    }
  }

  const days: DailyPlaytime[] = [...minutesByDay.entries()]
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const months: MonthlyPlaytime[] = [...minutesByMonth.entries()]
    .map(([month, minutes]) => ({ month, minutes }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { days, imprecise: { months, yearOnly } };
}
