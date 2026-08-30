// Check the setup state of the application

import { db } from "~~/lib/db";
import { user } from "~~/db/schema";

// e.g. user exists in the database
export default defineEventHandler(async (event) => {
  const existingUser = db.select().from(user).limit(1).get() ?? null;
  return {
    user: existingUser,
  };
});
