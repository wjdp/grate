<script setup lang="ts">
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { GameWithProviders } from "#shared/types/Game";

const props = defineProps<{ games: GameWithProviders[] }>();

const SSR_ROWS = 4;
const SSR_COLUMNS = 8;
const GAP = 16;
const OVERSCAN = 5;
const POSTER_ASPECT = 4 / 3;
const TEXT_BLOCK = 72;
// Keep in step with the `minmax(11rem, …)` in the pre-mount fallback grid.
const MIN_POSTER_WIDTH = 176;
const MIN_COLUMNS = 2;

const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const mounted = ref(false);

const columns = computed(() =>
  Math.max(
    MIN_COLUMNS,
    Math.floor((containerWidth.value + GAP) / (MIN_POSTER_WIDTH + GAP)),
  ),
);

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

const ssrGames = computed(() => props.games.slice(0, SSR_ROWS * SSR_COLUMNS));

let widthObserver: ResizeObserver | undefined;

onMounted(async () => {
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
      class="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]"
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
        class="absolute top-0 left-0 grid w-full gap-4 pb-4"
        :style="{
          transform: `translateY(${row.start - scrollMargin}px)`,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }"
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
