import { db } from "~~/lib/db";
import {
  game,
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
  gameStateChange,
  steamUser,
  gogIgnoredProduct,
  steamAppInfo,
  steamGame,
  gogGame,
  game,
  user,
  gogUser,
];

export function flushDb() {
  for (const table of TABLES) db.delete(table).run();
}
