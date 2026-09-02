import { startQrLogin } from "~~/server/providers/steam/qrRegistry";

export default defineEventHandler(async () => startQrLogin());
