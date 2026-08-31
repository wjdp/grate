import type { Ref } from "vue";

const MAX_REMEMBERED_ROUTES = 50;

/**
 * Keyed by `route.fullPath` so each set of filters keeps its own position, and
 * module-level so the offset outlives the component that recorded it.
 */
const savedOffsets = new Map<string, number>();

export function rememberScrollOffset(key: string, offset: number) {
  // Re-inserting keeps the map in least-recently-used order for the eviction below.
  savedOffsets.delete(key);
  savedOffsets.set(key, offset);
  while (savedOffsets.size > MAX_REMEMBERED_ROUTES) {
    const oldest = savedOffsets.keys().next().value;
    if (oldest === undefined) break;
    savedOffsets.delete(oldest);
  }
}

export function forgetScrollOffsets() {
  savedOffsets.clear();
}

/**
 * Virtualised views scroll inside the dashboard panel rather than the window, so
 * the router's own scroll restoration never sees them. Record the offset as it
 * changes — reading it back on unmount is too late, the panel has already been
 * torn down — and reapply it once the view has laid out at its full height.
 */
export function useScrollMemory(scrollElement: Ref<HTMLElement | null>) {
  const route = useRoute();

  let listening: HTMLElement | null = null;

  const handleScroll = () => {
    if (listening) rememberScrollOffset(route.fullPath, listening.scrollTop);
  };

  const detach = () => {
    listening?.removeEventListener("scroll", handleScroll);
    listening = null;
  };

  const stopWatching = watch(
    scrollElement,
    (element) => {
      detach();
      if (!element) return;
      listening = element;
      element.addEventListener("scroll", handleScroll, { passive: true });
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    stopWatching();
    detach();
  });

  const restore = () => {
    const element = scrollElement.value;
    const offset = savedOffsets.get(route.fullPath);
    if (!element || offset === undefined) return;
    element.scrollTop = offset;
  };

  return { restore };
}
