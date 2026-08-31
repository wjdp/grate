<script setup lang="ts">
import {
  type GameState,
  GameStateHues,
  GameStateIcons,
  GameStateNames,
} from "#shared/game-state";

interface StateItem {
  value: GameState | null;
  label: string;
  icon: string;
  iconClass: string;
}

const state = defineModel<GameState | null>();
const emit = defineEmits<{ change: [GameState | null] }>();

const toItem = (gameState: GameState): StateItem => ({
  value: gameState,
  label: GameStateNames[gameState],
  icon: GameStateIcons[gameState],
  iconClass: GameStateHues[gameState].icon,
});

const unsorted: StateItem = {
  value: null,
  label: "Unsorted",
  icon: "i-lucide-circle-dashed",
  iconClass: "text-grey-500 dark:text-grey-400",
};

const groups: StateItem[][] = [
  [unsorted],
  [toItem("BACKLOG")],
  [toItem("PLAYING"), toItem("PERIODIC"), toItem("SHELVED")],
  [
    toItem("PLAYED"),
    toItem("COMPLETED"),
    toItem("RETIRED"),
    toItem("ABANDONED"),
  ],
  [toItem("IGNORED")],
];

const items = groups.flat();

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
    :items="groups"
    :search-input="false"
    :ui="{
      content:
        'max-h-[min(24rem,var(--reka-combobox-content-available-height,24rem))]',
    }"
    class="w-48"
  >
    <template #leading>
      <UIcon
        :name="selected.icon"
        class="size-5 shrink-0"
        :class="selected.iconClass"
      />
    </template>
    <template #item-leading="{ item }">
      <UIcon
        :name="item.icon"
        class="size-5 shrink-0"
        :class="item.iconClass"
      />
    </template>
  </USelectMenu>
</template>
