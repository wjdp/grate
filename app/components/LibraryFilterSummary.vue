<script lang="ts" setup>
import type { GameWithProviders } from "#shared/types/Game";

const props = defineProps<{ games: GameWithProviders[] }>();

const totalMinutes = computed(() =>
  props.games.reduce((total, game) => total + game.playtimeMinutes, 0),
);

const playedCount = computed(
  () => props.games.filter((game) => game.playtimeMinutes > 0).length,
);

const gameCountLabel = computed(
  () => `${props.games.length} ${props.games.length === 1 ? "game" : "games"}`,
);

const detailSegments = computed(() => [
  { value: formatPlaytime(totalMinutes.value) || "0m", label: "total" },
  { value: `${playedCount.value}`, label: "played" },
  { value: `${props.games.length - playedCount.value}`, label: "unplayed" },
]);
</script>

<template>
  <div class="text-muted flex items-center gap-1.5 px-4 py-1.5 text-xs sm:px-6">
    <span class="text-highlighted tabular-nums">{{ gameCountLabel }}</span>
    <template v-for="segment in detailSegments" :key="segment.label">
      <span aria-hidden="true" class="hidden sm:inline">·</span>
      <span class="hidden sm:inline">
        <span class="text-highlighted tabular-nums">{{ segment.value }}</span>
        {{ segment.label }}
      </span>
    </template>
  </div>
</template>
