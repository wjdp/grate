import sleep from "~/utils/sleep";

export default async function sleepHandler() {
  const ms = 2000;
  await sleep(ms);
}
