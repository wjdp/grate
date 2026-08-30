import { getGogUser } from "~~/lib/gog/service";

export default defineEventHandler(async () => {
  const gogUser = await getGogUser();
  if (!gogUser) return null;
  return {
    gogUserId: gogUser.gogUserId,
    galaxyUserId: gogUser.galaxyUserId,
    username: gogUser.username,
  };
});
