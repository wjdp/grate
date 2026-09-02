import {
  findDuplicatePairs,
  getDistinctPairs,
} from "~~/server/services/duplicates";

export default defineEventHandler(async () => {
  return {
    pairs: await findDuplicatePairs(),
    distinct: await getDistinctPairs(),
  };
});
