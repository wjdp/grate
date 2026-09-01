<script setup lang="ts">
import type { GameState } from "#shared/game-state";
import {
  type GameStateItem,
  gameStateItemGroups,
  unsortedGameStateItem,
} from "~/utils/gameStateItems";

const state = defineModel<GameState | null>();
const emit = defineEmits<{ change: [GameState | null] }>();

const items = gameStateItemGroups.flat();

const selected = computed<GameStateItem>({
  get: () =>
    items.find((item) => item.value === (state.value ?? null)) ??
    unsortedGameStateItem,
  set: (item) => {
    state.value = item?.value ?? null;
    emit("change", state.value ?? null);
  },
});
</script>

<template>
  <USelectMenu
    v-model="selected"
    :items="gameStateItemGroups"
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
