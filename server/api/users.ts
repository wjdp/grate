import { defineEventHandler } from 'h3';
import prisma from '~/lib/prisma';

export default defineEventHandler(async (event) => {
    const users = await prisma.user.findMany()
    console.log(users);
    return {
        users: users
    };
});
