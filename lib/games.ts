import prisma from "./prisma";

export async function getGames() {
    const games = prisma.game.findMany({include: {steamGame: true}})
    return games;
}
