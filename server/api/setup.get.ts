// Check the setup state of the application

import { db } from "~~/server/database/client";
import { user } from "~~/server/database/schema";

// e.g. user exists in the database
export default defineEventHandler(async () => {
  const existingUser = db.select().from(user).limit(1).get() ?? null;
  return {
    user: existingUser,
  };
});
