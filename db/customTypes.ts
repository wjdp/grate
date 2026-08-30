import { customType, integer as drizzleInteger } from "drizzle-orm/sqlite-core";

// The connection runs with better-sqlite3's `defaultSafeIntegers(true)` so that
// SteamUser.steamId (76561198032111170, beyond Number.MAX_SAFE_INTEGER) reads
// back exactly. Every INTEGER therefore arrives as a bigint and each column
// type below narrows it to the JavaScript type the schema promises.
type SqliteInteger = number | bigint;

const toNumber = (value: SqliteInteger) => Number(value);

export const integer = customType<{
  data: number;
  driverData: SqliteInteger;
}>({
  dataType: () => "INTEGER",
  fromDriver: toNumber,
});

export const bigint = customType<{
  data: bigint;
  driverData: SqliteInteger;
}>({
  dataType: () => "BIGINT",
  fromDriver: BigInt,
});

export const boolean = customType<{
  data: boolean;
  driverData: SqliteInteger;
}>({
  dataType: () => "BOOLEAN",
  fromDriver: (value) => Number(value) === 1,
  toDriver: (value) => (value ? 1 : 0),
});

export const text = <TData extends string = string>(config?: {
  enum?: readonly TData[];
}) =>
  customType<{ data: TData; driverData: string; config: typeof config }>({
    dataType: () => "TEXT",
  })(config);

export const json = <TData = unknown>() =>
  customType<{ data: TData; driverData: string }>({
    dataType: () => "JSONB",
    fromDriver: (value) => JSON.parse(value) as TData,
    toDriver: (value) => JSON.stringify(value),
  })();

const ZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function parseDatetime(value: SqliteInteger | string): Date {
  if (typeof value !== "string") return new Date(Number(value));
  const isoish = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(ZONE_SUFFIX.test(isoish) ? isoish : `${isoish}Z`);
}

// Prisma wrote DateTime as unix milliseconds, so we do too: rolling back to the
// Prisma release must keep reading whatever Drizzle wrote. Reads additionally
// cope with the ISO text the gog_playtime backfill produced and with the
// zone-less "YYYY-MM-DD HH:MM:SS" that DEFAULT CURRENT_TIMESTAMP produces.
export const datetime = customType<{
  data: Date;
  driverData: SqliteInteger | string;
}>({
  dataType: () => "DATETIME",
  fromDriver: parseDatetime,
  toDriver: (value) => value.getTime(),
});

interface ColumnBuilderWithBuild {
  build: (table: never) => { mapFromDriverValue: (value: never) => unknown };
}

// customType() cannot express PRIMARY KEY AUTOINCREMENT, so these columns use
// Drizzle's own integer builder with the safe-integer narrowing bolted on.
export function autoIncrementId() {
  const builder = drizzleInteger().primaryKey({ autoIncrement: true });
  const build = (builder as unknown as ColumnBuilderWithBuild).build.bind(
    builder as unknown as ColumnBuilderWithBuild,
  );
  (builder as unknown as ColumnBuilderWithBuild).build = (table) => {
    const column = build(table);
    column.mapFromDriverValue = toNumber as never;
    return column;
  };
  return builder;
}
