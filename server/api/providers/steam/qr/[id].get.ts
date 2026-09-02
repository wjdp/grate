import { getQrLogin } from "~~/server/providers/steam/qrRegistry";

export default defineEventHandler((event) => {
  const login = getQrLogin(getRouterParam(event, "id") ?? "");
  if (!login) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Login attempt not found",
    });
  }
  return login;
});
