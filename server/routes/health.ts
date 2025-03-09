import prisma from "~/lib/prisma";

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1;`;
    return true;
  } catch {
    return false;
  }
}

export default defineEventHandler(async (event) => {
  const database = await checkDatabase();
  const ok = database;
  if (!ok) {
    setResponseStatus(event, 500);
  }
  return {
    ok,
    checks: {
      database,
    },
  };
});
