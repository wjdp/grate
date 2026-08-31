import { db } from "~~/lib/db";
import {
  epicGame,
  epicGamePlaytime,
  epicIgnoredItem,
  epicUser,
  game,
  gameDistinctPair,
  gameStateChange,
  gogGame,
  gogGamePlaytime,
  gogIgnoredProduct,
  gogUser,
  steamAppInfo,
  steamGame,
  steamGamePlaytime,
  steamUser,
  user,
} from "~~/db/schema";

const TABLES = [
  steamGamePlaytime,
  gogGamePlaytime,
  epicGamePlaytime,
  gameStateChange,
  steamUser,
  gogIgnoredProduct,
  epicIgnoredItem,
  steamAppInfo,
  steamGame,
  gogGame,
  epicGame,
  gameDistinctPair,
  game,
  user,
  gogUser,
  epicUser,
];

export function flushDb() {
  for (const table of TABLES) db.delete(table).run();
}
