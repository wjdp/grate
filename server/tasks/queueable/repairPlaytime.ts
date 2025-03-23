import prisma from "~/lib/prisma";
import type { SteamGame } from "@prisma/client";
import { DateTime } from "luxon";

async function repairPlaytimeForGame(game: SteamGame) {
  const playtimes = await prisma.steamGamePlaytime.findMany({
    where: { steamAppId: game.appId },
    orderBy: { timestampStart: "asc" },
  });
  if (playtimes.length === 1) {
    // No need to repair
    return;
  }
  console.log(`Repairing playtime for game ${game.name}`);
  for (let i = 0; i < playtimes.length; i++) {
    if (i === 0) continue;
    const lastPlaytime = playtimes[i - 1];
    const playtime = playtimes[i];
    if (playtime.timestampStart === null) continue;
    const playtimeDelta = DateTime.fromJSDate(playtime.timestampEnd).diff(
      DateTime.fromJSDate(playtime.timestampStart),
      "hours",
    );
    if (playtimeDelta.hours < 1.5) continue;

    if (lastPlaytime.playtimeForever === playtime.playtimeForever) continue;

    // update current row to only account for an hour
    const newTimestampEnd = DateTime.fromJSDate(playtime.timestampStart)
      .plus({ hours: 1 })
      .toJSDate();
    await prisma.steamGamePlaytime.update({
      where: { id: playtime.id },
      data: { timestampEnd: newTimestampEnd },
    });
    // copy playtime object without id
    const newPlaytime: any = { ...playtime };
    delete newPlaytime.id;
    // create new row for the remaining time
    await prisma.steamGamePlaytime.create({
      data: {
        ...newPlaytime,
        ...{
          steamAppId: game.appId,
          timestampStart: newTimestampEnd,
          timestampEnd: playtime.timestampEnd,
        },
      },
    });

    console.log({
      start: playtime.timestampStart,
      end: playtime.timestampEnd,
      newEnd: newTimestampEnd,
      delta: playtimeDelta,
      hours: playtime.playtimeForever,
    });
  }
}

export default async function repairPlaytimeHandler() {
  const steamGames = await prisma.steamGame.findMany();
  for (const steamGame of steamGames) {
    await repairPlaytimeForGame(steamGame);
  }
}
