import { faker } from "@faker-js/faker";
import type { GogGame } from "@prisma/client";
import prisma from "~/lib/prisma";
import { createGame } from "~/lib/steam/fixtures/fake";

export async function createGogGame(
  overrides: Partial<GogGame> = {},
): Promise<GogGame> {
  const game = await createGame({ name: overrides.name });
  return prisma.gogGame.create({
    data: {
      ...{
        gameId: game.id,
        gogId: faker.number.int({ min: 1, max: 2_000_000_000 }),
        name: game.name,
        tags: [],
        properties: [],
      },
      ...overrides,
    },
  });
}
