const STORAGE_KEY = "grate:recently-viewed-games";
const MAX_ENTRIES = 10;

interface RecentlyViewedEntry {
  id: number;
  viewedAt: number;
}

const isRecentlyViewedEntry = (value: unknown): value is RecentlyViewedEntry =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as RecentlyViewedEntry).id === "number" &&
  typeof (value as RecentlyViewedEntry).viewedAt === "number";

// Guards every localStorage touch: SSR has no localStorage, and a blocked or
// corrupt store (private browsing, quota, extensions) must degrade to "no recents"
// rather than throw.
const readEntries = (): RecentlyViewedEntry[] => {
  if (import.meta.server) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentlyViewedEntry);
  } catch {
    return [];
  }
};

const writeEntries = (entries: RecentlyViewedEntry[]) => {
  if (import.meta.server) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable or full — the in-memory state still reflects the view.
  }
};

/**
 * Tracks recently viewed games in localStorage for the command palette's
 * "Recently viewed" group. Shared reactive state via `useState` so every
 * caller in the app sees the same list without re-reading storage.
 */
export const useRecentlyViewedGames = () => {
  const entries = useState<RecentlyViewedEntry[]>(
    "recentlyViewedGames",
    readEntries,
  );

  const recordView = (id: number) => {
    const withoutId = entries.value.filter((entry) => entry.id !== id);
    entries.value = [{ id, viewedAt: Date.now() }, ...withoutId].slice(
      0,
      MAX_ENTRIES,
    );
    writeEntries(entries.value);
  };

  const recentGameIds = computed(() => entries.value.map((entry) => entry.id));

  return { recentGameIds, recordView };
};
