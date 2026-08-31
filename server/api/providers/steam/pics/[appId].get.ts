import { eq } from "drizzle-orm";
import { z } from "zod";
import { steamPicsMetadata } from "~~/db/schema";
import { db } from "~~/lib/db";

const AppIdSchema = z.coerce.number().int().positive();

export default defineEventHandler(async (event) => {
  const appId = AppIdSchema.safeParse(getRouterParam(event, "appId"));
  if (!appId.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid parameters" };
  }
  const row = db
    .select()
    .from(steamPicsMetadata)
    .where(eq(steamPicsMetadata.appId, appId.data))
    .get();
  return { picsMetadata: row ?? null };
});
