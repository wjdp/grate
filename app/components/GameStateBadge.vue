<script setup lang="ts">
import type { BadgeProps } from "@nuxt/ui";
import {
  type GameState,
  GameStateHues,
  GameStateIcons,
  GameStateNames,
} from "#shared/game-state";

defineProps<{ state: GameState | null; size?: BadgeProps["size"] }>();
</script>

<template>
  <UBadge
    v-if="state"
    variant="soft"
    color="neutral"
    :size="size"
    :icon="GameStateIcons[state]"
    :label="GameStateNames[state]"
    :class="GameStateHues[state].badge"
  />
  <UBadge
    v-else
    variant="soft"
    color="neutral"
    :size="size"
    icon="i-lucide-circle-dashed"
    label="Unsorted"
  />
</template>
