import { getServerInfo } from "~/lib/steam/api";
export default defineEventHandler(async (event) => {
  return getServerInfo();
});
