export default async function sleep() {
  const ms = 2000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
