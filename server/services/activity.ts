import { asc, eq } from "drizzle-orm";
import { type PlayDaySettings, playDayOf } from "#shared/playDay";
import { db } from "~~/server/database/client";
import {
  epicGamePlaytime,
  game,
  gogGamePlaytime,
  steamGamePlaytime,
} from "~~/server/database/schema";
import { getPlayDaySettings } from "~~/server/services/settings";

export interface DailyPlaytime {
  date: string;
  minutes: number;
}

interface Snapshot {
  rowKey: string;
  timestampEnd: Date;
  playtimeMinutes: number;
}

async function getHiddenRowKeys(): Promise<Set<string>> {
  const hiddenGames = await db.query.game.findMany({
    columns: { id: true },
    with: {
      steamGames: { columns: { appId: true } },
      gogGames: { columns: { gogId: true } },
      epicGames: { columns: { epicId: true } },
    },
    where: eq(game.hidden, true),
  });
  return new Set(
    hiddenGames.flatMap((hiddenGame) => [
      ...hiddenGame.steamGames.map((row) => `steam:${row.appId}`),
      ...hiddenGame.gogGames.map((row) => `gog:${row.gogId}`),
      ...hiddenGame.epicGames.map((row) => `epic:${row.epicId}`),
    ]),
  );
}

async function getSnapshots(): Promise<Snapshot[]> {
  const steamRecords = await db
    .select()
    .from(steamGamePlaytime)
    .orderBy(asc(steamGamePlaytime.timestampEnd), asc(steamGamePlaytime.id))
    .all();
  const gogRecords = await db
    .select()
    .from(gogGamePlaytime)
    .orderBy(asc(gogGamePlaytime.timestampEnd), asc(gogGamePlaytime.id))
    .all();
  const epicRecords = await db
    .select()
    .from(epicGamePlaytime)
    .orderBy(asc(epicGamePlaytime.timestampEnd), asc(epicGamePlaytime.id))
    .all();

  return [
    ...steamRecords.map((record) => ({
      rowKey: `steam:${record.steamAppId}`,
      timestampEnd: record.timestampEnd,
      playtimeMinutes: record.playtimeForever ?? 0,
    })),
    ...gogRecords.map((record) => ({
      rowKey: `gog:${record.gogId}`,
      timestampEnd: record.timestampEnd,
      playtimeMinutes: record.playtimeMinutes,
    })),
    ...epicRecords.map((record) => ({
      rowKey: `epic:${record.epicId}`,
      timestampEnd: record.timestampEnd,
      playtimeMinutes: record.playtimeMinutes,
    })),
  ];
}

export async function getDailyPlaytime(
  year: number,
  settings?: PlayDaySettings,
): Promise<DailyPlaytime[]> {
  const playDaySettings = settings ?? (await getPlayDaySettings());
  const snapshots = await getSnapshots();
  const hiddenRowKeys = await getHiddenRowKeys();
  const previousByRow = new Map<string, number>();
  const minutesByDate = new Map<string, number>();

  for (const snapshot of snapshots) {
    if (hiddenRowKeys.has(snapshot.rowKey)) continue;
    const previous = previousByRow.get(snapshot.rowKey);
    previousByRow.set(snapshot.rowKey, snapshot.playtimeMinutes);
    if (previous === undefined) continue;

    const delta = snapshot.playtimeMinutes - previous;
    if (delta <= 0) continue;

    const date = playDayOf(snapshot.timestampEnd, playDaySettings);
    minutesByDate.set(date, (minutesByDate.get(date) ?? 0) + delta);
  }

  return [...minutesByDate.entries()]
    .filter(([date]) => date.startsWith(`${year}-`))
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
