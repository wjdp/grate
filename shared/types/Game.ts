import type { getGame, getGames } from "~~/lib/games";

// Routes hand games to the client as JSON, so every Date arrives as an ISO string.
type Serialised<T> = T extends Date
  ? string
  : T extends (infer Element)[]
    ? Serialised<Element>[]
    : T extends object
      ? { [Key in keyof T]: Serialised<T[Key]> }
      : T;

export type GameWithProviders = Serialised<
  Awaited<ReturnType<typeof getGames>>[number]
>;

export type GameDetail = Serialised<
  NonNullable<Awaited<ReturnType<typeof getGame>>>
>;
