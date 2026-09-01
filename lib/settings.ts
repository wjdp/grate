import { eq } from "drizzle-orm";
import { IANAZone } from "luxon";
import type { PlayDaySettings } from "#shared/playDay";
import type { SettingsPatch } from "#shared/schemas/settings";
import { user } from "~~/db/schema";
import { db } from "~~/lib/db";

export const DEFAULT_DAY_BOUNDARY_HOUR = 6;

export interface Settings {
  timezone: string | null;
  dayBoundaryHour: number;
  serverTimezone: string;
  effectiveTimezone: string;
}

export function serverTimezone(): string {
  const configured = process.env.TZ;
  if (configured && IANAZone.isValidZone(configured)) return configured;
  return "UTC";
}

function firstUser() {
  return db.select().from(user).limit(1).get() ?? null;
}

function ensureUser() {
  return firstUser() ?? db.insert(user).values({}).returning().get();
}

export async function getPlayDaySettings(): Promise<PlayDaySettings> {
  const existingUser = firstUser();
  return {
    timezone: existingUser?.timezone ?? serverTimezone(),
    dayBoundaryHour: existingUser?.dayBoundaryHour ?? DEFAULT_DAY_BOUNDARY_HOUR,
  };
}

export async function getSettings(): Promise<Settings> {
  const existingUser = firstUser();
  const timezone = existingUser?.timezone ?? null;
  const server = serverTimezone();
  return {
    timezone,
    dayBoundaryHour: existingUser?.dayBoundaryHour ?? DEFAULT_DAY_BOUNDARY_HOUR,
    serverTimezone: server,
    effectiveTimezone: timezone ?? server,
  };
}

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  if (
    patch.timezone !== undefined &&
    patch.timezone !== null &&
    !IANAZone.isValidZone(patch.timezone)
  ) {
    throw new Error(`Unknown timezone: ${patch.timezone}`);
  }

  const existingUser = ensureUser();
  db.update(user)
    .set({
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      ...(patch.dayBoundaryHour !== undefined
        ? { dayBoundaryHour: patch.dayBoundaryHour }
        : {}),
    })
    .where(eq(user.id, existingUser.id))
    .run();

  return getSettings();
}
