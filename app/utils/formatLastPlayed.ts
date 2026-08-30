type LastPlayed = Date | string | number;

function toDate(lastPlayed: LastPlayed): Date {
  // Steam supplies unix seconds, Game.lastPlayedAt arrives as a Date on the
  // server and an ISO string over tRPC (no superjson transformer configured).
  return typeof lastPlayed === "number"
    ? new Date(lastPlayed * 1000)
    : new Date(lastPlayed);
}

export default function formatLastPlayed(lastPlayed: LastPlayed) {
  return toDate(lastPlayed).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
