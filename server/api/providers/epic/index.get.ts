import { getEpicUser } from "~~/server/providers/epic/service";

export default defineEventHandler(async () => {
  const epicUser = await getEpicUser();
  if (!epicUser) return null;
  return {
    accountId: epicUser.accountId,
    displayName: epicUser.displayName,
  };
});
