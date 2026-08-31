// @vitest-environment nuxt
import { beforeEach, describe, expect, it } from "vitest";
import { useRecentlyViewedGames } from "./useRecentlyViewedGames";

const STORAGE_KEY = "grate:recently-viewed-games";

// useState shares one ref per key across the whole test file (single Nuxt app
// instance), so clear both the storage and the cached state before each test —
// otherwise the composable's lazy init from localStorage never re-runs. Using
// reset: false deletes the cached value rather than eagerly recomputing it, so
// the next useRecentlyViewedGames() call re-reads whatever localStorage holds
// at that point in the test.
beforeEach(() => {
  localStorage.clear();
  clearNuxtState(["recentlyViewedGames"], { reset: false });
});

describe("useRecentlyViewedGames", () => {
  it("starts empty when nothing is stored", () => {
    const { recentGameIds } = useRecentlyViewedGames();

    expect(recentGameIds.value).toEqual([]);
  });

  it("records a view, most recent first", () => {
    const { recentGameIds, recordView } = useRecentlyViewedGames();

    recordView(1);
    recordView(2);

    expect(recentGameIds.value).toEqual([2, 1]);
  });

  it("moves a re-viewed id to the front instead of duplicating it", () => {
    const { recentGameIds, recordView } = useRecentlyViewedGames();

    recordView(1);
    recordView(2);
    recordView(3);
    recordView(1);

    expect(recentGameIds.value).toEqual([1, 3, 2]);
  });

  it("caps the list at 10 entries, dropping the oldest", () => {
    const { recentGameIds, recordView } = useRecentlyViewedGames();

    for (let id = 1; id <= 11; id++) recordView(id);

    expect(recentGameIds.value).toHaveLength(10);
    expect(recentGameIds.value).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    expect(recentGameIds.value).not.toContain(1);
  });

  it("persists views to localStorage as id/viewedAt pairs", () => {
    const { recordView } = useRecentlyViewedGames();

    recordView(42);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(42);
    expect(typeof stored[0].viewedAt).toBe("number");
  });

  it("reads previously persisted entries back on a fresh init", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 8, viewedAt: 2 },
        { id: 7, viewedAt: 1 },
      ]),
    );

    const { recentGameIds } = useRecentlyViewedGames();

    expect(recentGameIds.value).toEqual([8, 7]);
  });

  it("treats malformed stored JSON as an empty list", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");

    const { recentGameIds } = useRecentlyViewedGames();

    expect(recentGameIds.value).toEqual([]);
  });

  it("ignores non-array or malformed entries in otherwise valid JSON", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 1, viewedAt: 1 }));

    const { recentGameIds } = useRecentlyViewedGames();

    expect(recentGameIds.value).toEqual([]);
  });
});
