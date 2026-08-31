// Check the setup state of the application

import { user } from "~~/db/schema";
import { db } from "~~/lib/db";

// e.g. user exists in the database
export default defineEventHandler(async () => {
  const existingUser = db.select().from(user).limit(1).get() ?? null;
  return {
    user: existingUser,
  };
});
