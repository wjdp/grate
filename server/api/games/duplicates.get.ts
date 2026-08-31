import { findDuplicatePairs, getDistinctPairs } from "~~/lib/duplicates";

export default defineEventHandler(async () => {
  return {
    pairs: await findDuplicatePairs(),
    distinct: await getDistinctPairs(),
  };
});
