import { z } from "zod";
import { createErrorFromRequestValidation } from "~/utils/createErrorFromRequestValidation";
import * as steam from "~/lib/steam/api";
import createErrorFromSteamApiError from "~/utils/createErrorFromSteamApiError";
import { db } from "~~/lib/db";
import { steamUser, user } from "~~/db/schema";

const requestSchema = z.object({});

export default defineEventHandler(async (event) => {
  let data: z.infer<typeof requestSchema>;
  try {
    const body = await readBody(event);
    data = requestSchema.parse(body);
  } catch (error) {
    throw createErrorFromRequestValidation(error);
  }
  let steamUserInfo;
  try {
    steamUserInfo = await steam.getUserInfo();
  } catch (error) {
    throw createErrorFromSteamApiError(error);
  }
  db.transaction((tx) => {
    const newUser = tx.insert(user).values({}).returning().get();
    tx.insert(steamUser)
      .values({
        steamId: BigInt(steamUserInfo.steamid),
        userId: newUser.id,
        personaName: steamUserInfo.personaname,
        realName: steamUserInfo.realname,
        profileUrl: steamUserInfo.profileurl,
        avatar: steamUserInfo.avatar,
        avatarMedium: steamUserInfo.avatarmedium,
        avatarFull: steamUserInfo.avatarfull,
        avatarHash: steamUserInfo.avatarhash,
        lastLogoff: steamUserInfo.lastlogoff,
      })
      .run();
  });
  return { status: "ok" };
});
