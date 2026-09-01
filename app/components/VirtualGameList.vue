<script setup lang="ts">
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { GameWithProviders } from "#shared/types/Game";

const props = defineProps<{ games: GameWithProviders[] }>();

const SSR_ROWS = 24;
const ROW_HEIGHT = 48;
const OVERSCAN = 5;

const containerRef = ref<HTMLElement | null>(null);
const mounted = ref(false);

const { scrollElement, scrollMargin, measure } = useScrollParent(containerRef);
const { restore } = useScrollMemory(scrollElement);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.games.length,
    getScrollElement: () => scrollElement.value,
    estimateSize: () => ROW_HEIGHT,
    scrollMargin: scrollMargin.value,
    overscan: OVERSCAN,
  })),
);

const virtualRows = computed(() => virtualizer.value.getVirtualItems());

const ssrGames = computed(() => props.games.slice(0, SSR_ROWS));

onMounted(async () => {
  mounted.value = true;
  // The SSR fallback is far shorter than the real list, so the saved offset only
  // survives once the virtualiser has rendered at its full height.
  await nextTick();
  await nextTick();
  restore();
});

watch(
  () => props.games,
  () => {
    virtualizer.value.measure();
    nextTick(measure);
  },
);
</script>

<template>
  <div
    ref="containerRef"
    class="border-default overflow-hidden rounded-lg border"
  >
    <div v-if="!mounted">
      <GameRow v-for="game in ssrGames" :key="game.id" :game="game" />
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
        class="absolute top-0 left-0 w-full"
        :style="{ transform: `translateY(${row.start - scrollMargin}px)` }"
      >
        <GameRow :game="games[row.index]" />
      </div>
    </div>
  </div>
</template>
