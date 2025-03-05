import { mergeRouters } from '../trpc'
import { gamesRouter } from './games'
import { debugRouter } from './debug'

export const appRouter = mergeRouters(
    gamesRouter,
    debugRouter
)

// export type definition of API
export type AppRouter = typeof appRouter
