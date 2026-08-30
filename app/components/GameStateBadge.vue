<script setup lang="ts">
import {
  GameStateHues,
  GameStateIcons,
  GameStateNames,
  type GameState,
} from "#shared/game-state";

defineProps<{ state: GameState | null }>();
</script>

<template>
  <UBadge
    v-if="state"
    variant="soft"
    color="neutral"
    :icon="GameStateIcons[state]"
    :label="GameStateNames[state]"
    :class="GameStateHues[state].badge"
  />
  <UBadge
    v-else
    variant="soft"
    color="neutral"
    icon="i-lucide-circle-dashed"
    label="Unsorted"
  />
</template>
