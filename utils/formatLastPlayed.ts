export default function formatLastPlayed(lastPlayed: number) {
  // Last played is a Unix timestamp
  const date = new Date(lastPlayed * 1000);
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
