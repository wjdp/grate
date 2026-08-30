import { eq } from "drizzle-orm";
import { gogGame, steamGame } from "~~/db/schema";
import { db, type Db } from "~~/lib/db";

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type DbOrTransaction = Db | Transaction;

export function countProviderRows(
  gameId: number,
  client: DbOrTransaction = db,
): number {
  const steamRows = client
    .select({ appId: steamGame.appId })
    .from(steamGame)
    .where(eq(steamGame.gameId, gameId))
    .all();
  const gogRows = client
    .select({ gogId: gogGame.gogId })
    .from(gogGame)
    .where(eq(gogGame.gameId, gameId))
    .all();
  return steamRows.length + gogRows.length;
}
