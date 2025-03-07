<script lang="ts" setup>
import type { GameWithSteam } from "~/shared/types/Game";

defineProps<{
  game: GameWithSteam;
}>();
</script>

<template>
  <li class="flex">
    <div class="h-12 w-12 pr-2">
      <NuxtLink :to="`/game/${game.id}`">
        <GameIcon :game="game" class="" />
      </NuxtLink>
    </div>
    <div class="shrink-0">
      <NuxtLink :to="`/game/${game.id}`">
        <h4 class="-mb-1 w-64 truncate">
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
