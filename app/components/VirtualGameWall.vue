<script setup lang="ts">
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { GameWithProviders } from "#shared/types/Game";

const props = defineProps<{ games: GameWithProviders[] }>();

const SSR_ROWS = 4;
const GAP = 16;
const OVERSCAN = 5;
const POSTER_ASPECT = 4 / 3;
const TEXT_BLOCK = 72;

/**
 * Mirrors `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6` — the
 * classes are viewport media queries, so `matchMedia` is what keeps the number
 * of games we slice into a row in step with what the CSS actually lays out.
 */
const COLUMN_BREAKPOINTS = [
  { query: "(min-width: 64rem)", columns: 6 },
  { query: "(min-width: 48rem)", columns: 4 },
  { query: "(min-width: 40rem)", columns: 3 },
] as const;

const columns = ref(2);
const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const mounted = ref(false);

const { scrollElement, scrollMargin, measure } = useScrollParent(containerRef);
const { restore } = useScrollMemory(scrollElement);

const estimatedRowHeight = computed(() => {
  const width = containerWidth.value;
  if (!width) return 320;
  const posterWidth = (width - GAP * (columns.value - 1)) / columns.value;
  return posterWidth * POSTER_ASPECT + TEXT_BLOCK + GAP;
});

const rowCount = computed(() => Math.ceil(props.games.length / columns.value));

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rowCount.value,
    getScrollElement: () => scrollElement.value,
    estimateSize: () => estimatedRowHeight.value,
    scrollMargin: scrollMargin.value,
    overscan: OVERSCAN,
  })),
);

const virtualRows = computed(() => virtualizer.value.getVirtualItems());

const rowGames = (index: number) =>
  props.games.slice(index * columns.value, (index + 1) * columns.value);

const ssrGames = computed(() => props.games.slice(0, SSR_ROWS * 6));

let mediaQueries: MediaQueryList[] = [];
let widthObserver: ResizeObserver | undefined;

const readColumns = () => {
  const match = COLUMN_BREAKPOINTS.find(
    (breakpoint) => window.matchMedia(breakpoint.query).matches,
  );
  columns.value = match?.columns ?? 2;
};

onMounted(async () => {
  readColumns();
  mediaQueries = COLUMN_BREAKPOINTS.map(({ query }) =>
    window.matchMedia(query),
  );
  mediaQueries.forEach((query) =>
    query.addEventListener("change", readColumns),
  );

  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth;
    widthObserver = new ResizeObserver(([entry]) => {
      if (entry) containerWidth.value = entry.contentRect.width;
    });
    widthObserver.observe(containerRef.value);
  }

  mounted.value = true;
  // The SSR fallback is far shorter than the real wall, so the saved offset only
  // survives once the virtualiser has rendered at its full height.
  await nextTick();
  await nextTick();
  restore();
});

onBeforeUnmount(() => {
  mediaQueries.forEach((query) =>
    query.removeEventListener("change", readColumns),
  );
  widthObserver?.disconnect();
});

watch([columns, () => props.games], () => {
  virtualizer.value.measure();
  nextTick(measure);
});
</script>

<template>
  <div ref="containerRef">
    <div
      v-if="!mounted"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
    >
      <GamePoster v-for="game in ssrGames" :key="game.id" :game="game" />
    </div>
    <div
      v-else
      class="relative w-full"
      :style="{ height: `${virtualizer.getTotalSize()}px` }"
    >
      <div
        v-for="row in virtualRows"
        :key="row.index"
        :ref="(el) => virtualizer.measureElement(el as Element | null)"
        :data-index="row.index"
        class="absolute top-0 left-0 grid w-full grid-cols-2 gap-4 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        :style="{ transform: `translateY(${row.start - scrollMargin}px)` }"
      >
        <GamePoster
          v-for="game in rowGames(row.index)"
          :key="game.id"
          :game="game"
        />
      </div>
    </div>
  </div>
</template>
