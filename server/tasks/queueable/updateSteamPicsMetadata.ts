import { updatePicsMetadata } from "~~/lib/steam/picsMetadata";
import { updateInProgressTask } from "~~/server/tasks/queue";
import type { Task } from "~~/server/tasks/queue";
import { deleteCachedArt } from "~~/server/art";

export default async (task: Task) => {
  const { appIdsWithChangedArt, tagCount } = await updatePicsMetadata(
    (message) => updateInProgressTask(task, { message }),
  );

  await updateInProgressTask(task, {
    message: `Stored ${tagCount} store tags`,
  });

  for (const appId of appIdsWithChangedArt) {
    await deleteCachedArt({ provider: "steam", id: appId });
  }

  await updateInProgressTask(task, {
    progress: 1,
    message: `Invalidated art for ${appIdsWithChangedArt.length} games`,
  });
};
