import { ART_DIR } from "~~/server/constants";
import { checkFileExists } from "~~/server/files";
import type { ArtKey } from "./types";

// The extension a cached file gets is whatever its content type said at write
// time, so serving has to probe. Legacy Steam files are all `.jpg`.
export const CACHED_ART_EXTENSIONS = ["jpg", "png", "webp", "gif", "avif"];

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const FALLBACK_EXTENSION = "jpg";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export function extensionForContentType(contentType: string): string {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  return EXTENSION_BY_CONTENT_TYPE[type] ?? FALLBACK_EXTENSION;
}

export function contentTypeForPath(path: string): string | null {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? null;
}

export function artDirectory({
  provider,
  id,
}: Pick<ArtKey, "provider" | "id">) {
  return `${ART_DIR}/${provider}/${id}`;
}

export function artFilePath(key: ArtKey, extension: string) {
  return `${artDirectory(key)}/${key.type}.${extension}`;
}

export async function findCachedArtFile(key: ArtKey): Promise<string | null> {
  for (const extension of CACHED_ART_EXTENSIONS) {
    const path = artFilePath(key, extension);
    if (await checkFileExists(path)) {
      return path;
    }
  }
  return null;
}
