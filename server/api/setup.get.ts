// Check the setup state of the application

import prisma from "~/lib/prisma";

// e.g. user exists in the database
export default defineEventHandler(async (event) => {
  const user = await prisma.user.findFirst();
  return {
    user: user,
  };
});
