import prisma from '~/lib/prisma';

export default defineEventHandler(async (event) => {
    const user = await prisma.user.findFirst()
    // get steam user for  user
    const steamUser = await prisma.steamUser.findFirst({
        where: {
            userId: user.id
        }
    });
    return {
        user, steamUser
    };
});
