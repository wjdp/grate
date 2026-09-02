import { cancelQrLogin } from "~~/server/providers/steam/qrRegistry";

export default defineEventHandler((event) => {
  cancelQrLogin(getRouterParam(event, "id") ?? "");
  return { ok: true };
});
