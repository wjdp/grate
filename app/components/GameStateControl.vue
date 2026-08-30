<script setup lang="ts">
import {
  GAME_STATES,
  GameStateHues,
  GameStateIcons,
  GameStateNames,
  type GameState,
} from "#shared/game-state";

interface StateItem {
  value: GameState | null;
  label: string;
  icon: string;
  dot: string;
}

const state = defineModel<GameState | null>();
const emit = defineEmits<{ change: [GameState | null] }>();

const items: StateItem[] = [
  {
    value: null,
    label: "Unsorted",
    icon: "i-lucide-circle-dashed",
    dot: "bg-grey-400",
  },
  ...GAME_STATES.map((gameState) => ({
    value: gameState,
    label: GameStateNames[gameState],
    icon: GameStateIcons[gameState],
    dot: GameStateHues[gameState].dot,
  })),
];

const unsorted = items[0]!;

const selected = computed<StateItem>({
  get: () =>
    items.find((item) => item.value === (state.value ?? null)) ?? unsorted,
  set: (item) => {
    state.value = item?.value ?? null;
    emit("change", state.value ?? null);
  },
});
</script>

<template>
  <USelectMenu
    v-model="selected"
    :items="items"
    :search-input="false"
    class="w-48"
  >
    <template #leading>
      <span class="size-2 rounded-full" :class="selected.dot" />
    </template>
    <template #item-leading="{ item }">
      <span class="size-2 rounded-full" :class="item.dot" />
    </template>
  </USelectMenu>
</template>
