<script lang="ts" setup>
import type { GameWithSteam } from "~/shared/types/Game";

defineProps<{
  game: GameWithSteam;
}>();
</script>

<template>
  <li class="flex">
    <div class="w-12 h-12 pr-2">
      <NuxtLink :to="`/game/${game.id}`">
        <GameIcon :game="game" class="" />
      </NuxtLink>
    </div>
    <div class="shrink-0">
      <NuxtLink :to="`/game/${game.id}`">
        <h4 class="truncate w-64 -mb-1">
          {{ game.name }}
        </h4>
        <div class="text-sm">
          <span v-if="game.steamGame?.playtimeForever">
            {{ formatPlaytime(game.steamGame?.playtimeForever ?? 0) }}
          </span>
          <span v-else> Unplayed </span>
        </div>
      </NuxtLink>
    </div>
  </li>
</template>
