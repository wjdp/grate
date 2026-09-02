import { cancelQrLogin } from "~~/lib/steam/qrRegistry";

export default defineEventHandler((event) => {
  cancelQrLogin(getRouterParam(event, "id") ?? "");
  return { ok: true };
});
