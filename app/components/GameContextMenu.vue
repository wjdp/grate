<script setup lang="ts">
import type { ContextMenuItem } from "@nuxt/ui";
import { getPrimaryLaunch } from "#shared/providers";
import type { GameWithProviders } from "#shared/types/Game";
import { gameStateItemGroups } from "~/utils/gameStateItems";

const props = defineProps<{ game: GameWithProviders }>();

const setGameState = useSetGameState();

const currentState = computed(() => props.game.state ?? null);

const stateItems = computed<ContextMenuItem[][]>(() =>
  gameStateItemGroups.map((group) =>
    group.map((item) => ({
      type: "checkbox" as const,
      label: item.label,
      icon: item.icon,
      iconClass: item.iconClass,
      checked: item.value === currentState.value,
      disabled: item.value === currentState.value,
      onSelect: () => {
        setGameState(props.game, item.value);
      },
    })),
  ),
);

const items = computed<ContextMenuItem[][]>(() => {
  const groups: ContextMenuItem[][] = [
    [{ type: "label", label: props.game.name }],
    [
      {
        label: "Set state",
        icon: "i-lucide-tag",
        children: stateItems.value,
      },
    ],
  ];
  const launch = getPrimaryLaunch(props.game);
  if (launch) {
    groups.push([
      {
        label: "Play",
        icon: "i-lucide-play",
        onSelect: () => openLaunchUrl(launch.playUrl),
      },
      {
        label: "Open store page",
        icon: "i-lucide-external-link",
        onSelect: () => openLaunchUrl(launch.openUrl),
      },
    ]);
  }
  return groups;
});
</script>

<template>
  <UContextMenu :items="items">
    <slot />
    <template #item-leading="{ item }">
      <UIcon
        v-if="item.icon"
        :name="item.icon"
        class="size-5 shrink-0"
        :class="item.iconClass"
      />
    </template>
  </UContextMenu>
</template>
