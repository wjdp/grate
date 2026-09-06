import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { artConditionalHeaders, isNotModified } from "./httpCache";

const path = join(mkdtempSync(join(tmpdir(), "grate-art-http-")), "poster.jpg");
writeFileSync(path, Buffer.from([1, 2, 3, 4]));

const headers = await artConditionalHeaders(path);

describe("artConditionalHeaders", () => {
  it("caches for a day with a weak validator", () => {
    expect(headers["Cache-Control"]).toBe("public, max-age=86400");
    expect(headers.ETag).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
    expect(Date.parse(headers["Last-Modified"])).not.toBeNaN();
  });
});

describe("isNotModified", () => {
  it("matches the etag the client echoes back", () => {
    expect(isNotModified(headers, { ifNoneMatch: headers.ETag })).toBe(true);
    expect(isNotModified(headers, { ifNoneMatch: `W/"other"` })).toBe(false);
  });

  it("matches one etag in a list, and the wildcard", () => {
    expect(
      isNotModified(headers, { ifNoneMatch: `W/"other", ${headers.ETag}` }),
    ).toBe(true);
    expect(isNotModified(headers, { ifNoneMatch: "*" })).toBe(true);
  });

  it("prefers the etag over the timestamp when both are sent", () => {
    expect(
      isNotModified(headers, {
        ifNoneMatch: `W/"stale"`,
        ifModifiedSince: new Date(Date.now() + 60_000).toUTCString(),
      }),
    ).toBe(false);
  });

  it("falls back to the modification date", () => {
    expect(
      isNotModified(headers, {
        ifModifiedSince: new Date(Date.now() + 60_000).toUTCString(),
      }),
    ).toBe(true);
    expect(
      isNotModified(headers, {
        ifModifiedSince: new Date(Date.now() - 60_000).toUTCString(),
      }),
    ).toBe(false);
    expect(isNotModified(headers, { ifModifiedSince: "not a date" })).toBe(
      false,
    );
  });

  it("is a miss when the client sends no validators", () => {
    expect(isNotModified(headers, {})).toBe(false);
  });
});
