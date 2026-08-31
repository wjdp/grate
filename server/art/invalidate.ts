import fs from "fs";
import { artDirectory } from "./paths";
import type { ArtKey } from "./types";

// Drops every cached file and `.missing` marker for a game, so the next render
// re-resolves its sources. Used when upstream art paths change.
export async function deleteCachedArt(
  key: Pick<ArtKey, "provider" | "id">,
): Promise<void> {
  await fs.promises.rm(artDirectory(key), { recursive: true, force: true });
}
