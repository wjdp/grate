import type { SteamGame } from "@prisma/client";
import prisma from "../prisma";
import { getUserGames, getUserInfo, type UserGame } from "./api"

export async function updateUser() {
    const currentUser = await prisma.steamUser.findFirst();
    if (!currentUser) {
        throw new Error("User not found");
    }
    const steamUser = await getUserInfo();
    const updateUser = await prisma.steamUser.update({
        where: { steamId: currentUser.steamId },
        data: {
            personaName: steamUser.personaname,
            realName: steamUser.realname,
            profileUrl: steamUser.profileurl,
            avatar: steamUser.avatar,
            avatarMedium: steamUser.avatarmedium,
            avatarFull: steamUser.avatarfull,
            avatarHash: steamUser.avatarhash,
            lastLogoff: steamUser.lastlogoff,
        }
    });
    return updateUser;
}

async function createGame(game: UserGame) {
    const newGame = await prisma.game.create({
        data: {
            name: game.name,
            steamGame: {
                create: {
                    appId: game.appid,
                    name: game.name,
                    playtimeForever: game.playtime_forever,
                    playtime2weeks: game.playtime_2weeks,
                    playtimeWindowsForever: game.playtime_windows_forever,
                    playtimeMacForever: game.playtime_mac_forever,
                    playtimeLinuxForever: game.playtime_linux_forever,
                    playtimeDeckForever: game.playtime_deck_forever,
                    playtimeDisconnected: game.playtime_disconnected,
                    rTimeLastPlayed: game.rtime_last_played,
                    imgIconUrl: game.img_icon_url,
                    capsuleFilename: game.capsule_filename,
                    hasCommunityVisibleStats: game.has_community_visible_stats,
                    hasWorkshop: game.has_workshop,
                    hasDlc: game.has_dlc,
                    hasLeaderboards: game.has_leaderboards,
                }
            }
        },
        include: { steamGame: true }
    })
    return newGame.steamGame as SteamGame;

}

async function updateGame(game: UserGame) {
    const updatedGame = await prisma.steamGame.update({
        where: { appId: game.appid },
        data: {
            name: game.name,
            playtimeForever: game.playtime_forever,
            playtime2weeks: game.playtime_2weeks,
            playtimeWindowsForever: game.playtime_windows_forever,
            playtimeMacForever: game.playtime_mac_forever,
            playtimeLinuxForever: game.playtime_linux_forever,
            playtimeDeckForever: game.playtime_deck_forever,
            playtimeDisconnected: game.playtime_disconnected,
            rTimeLastPlayed: game.rtime_last_played,
            imgIconUrl: game.img_icon_url,
            capsuleFilename: game.capsule_filename,
            hasCommunityVisibleStats: game.has_community_visible_stats,
            hasWorkshop: game.has_workshop,
            hasDlc: game.has_dlc,
            hasLeaderboards: game.has_leaderboards,
        }
    });
    return updatedGame;
}

async function updateOrCreateGame(game: UserGame) {
    // check if the game exists
    const existingGame = await prisma.steamGame.findFirst({ where: { appId: game.appid } });
    if (existingGame) {
        const updatedGame = await updateGame(game);
        console.log(`Updated game ${updatedGame.name}`);
        return updatedGame;
    }
    const createdGame = await createGame(game);
    console.log(`Created game ${createdGame.name}`);
}

export async function updateGames() {
    const currentUser = await prisma.steamUser.findFirst();
    if (!currentUser) {
        throw new Error("User not found");
    }
    const games = await getUserGames();
    for (const game of games) {
        await updateOrCreateGame(game);
    }
    return games;
}

export async function recordPlaytimes() {
    const steamGamesInDb = await prisma.steamGame.findMany();
    const userOwnedGames = await getUserGames();
    const timestamp = new Date();
    for (const game of userOwnedGames) {
        const dbGame = steamGamesInDb.find(g => g.appId === game.appid);
        if (!dbGame) {
            console.error(`Game ${game.name} not found in db`);
            continue;
        }
        await prisma.steamGamePlaytime.create({
            data: {
                steamGame: { connect: { appId: game.appid } },
                timestamp,
                playtimeForever: game.playtime_forever,
                playtime2weeks: game.playtime_2weeks,
                playtimeWindowsForever: game.playtime_windows_forever,
                playtimeMacForever: game.playtime_mac_forever,
                playtimeLinuxForever: game.playtime_linux_forever,
                playtimeDeckForever: game.playtime_deck_forever,
                playtimeDisconnected: game.playtime_disconnected,
                rTimeLastPlayed: game.rtime_last_played,
            }
        });
        console.log(`Recorded playtime for ${game.name}`);
    }
}
