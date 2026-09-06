<script setup lang="ts">
import type { ContextMenuItem } from "@nuxt/ui";
import { getPrimaryLaunch } from "#shared/providers";
import type { GameWithProviders } from "#shared/types/Game";
import { gameStateItemGroups } from "~/utils/gameStateItems";

const props = defineProps<{ games: GameWithProviders[] }>();

const setGameState = useSetGameState();
const setGameHidden = useSetGameHidden();

const gamesById = computed(
  () => new Map(props.games.map((game) => [String(game.id), game])),
);

const targetGame = ref<GameWithProviders | null>(null);
const wrapperRef = ref<HTMLElement | null>(null);

// A single menu serves every game in the container, so the target has to be
// resolved before Reka's own contextmenu handler opens the menu. Reka waits a
// tick before opening; this capture-phase listener runs first either way.
const onContextMenu = (event: MouseEvent) => {
  const element = (event.target as Element | null)?.closest?.("[data-game-id]");
  const game = element
    ? gamesById.value.get(element.getAttribute("data-game-id") ?? "")
    : undefined;
  targetGame.value = game ?? null;
  if (!game) event.stopPropagation();
};

onMounted(() => {
  wrapperRef.value?.addEventListener("contextmenu", onContextMenu, true);
});

onBeforeUnmount(() => {
  wrapperRef.value?.removeEventListener("contextmenu", onContextMenu, true);
});

const stateItems = computed<ContextMenuItem[][]>(() => {
  const game = targetGame.value;
  if (!game) return [];
  return gameStateItemGroups.map((group) =>
    group.map((item) => ({
      type: "checkbox" as const,
      label: item.label,
      icon: item.icon,
      iconClass: item.iconClass,
      checked: item.value === (game.state ?? null),
      disabled: item.value === (game.state ?? null),
      onSelect: () => {
        setGameState(game, item.value);
      },
    })),
  );
});

const items = computed<ContextMenuItem[][]>(() => {
  const game = targetGame.value;
  if (!game) return [];
  const groups: ContextMenuItem[][] = [
    [{ type: "label", label: game.name }],
    [
      {
        label: "Set state",
        icon: "i-lucide-tag",
        children: stateItems.value,
      },
    ],
  ];
  const launch = getPrimaryLaunch(game);
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
  groups.push([
    {
      label: game.hidden ? "Unhide" : "Hide",
      icon: game.hidden ? "i-lucide-eye" : "i-lucide-eye-off",
      onSelect: () => {
        setGameHidden(game, !game.hidden);
      },
    },
  ]);
  return groups;
});
</script>

<template>
  <div ref="wrapperRef" class="contents">
    <UContextMenu :items="items">
      <!-- Reka's as-child trigger takes over the element it is given, so it
      gets a wrapper of its own rather than the caller's slot root. -->
      <div class="contents">
        <slot />
      </div>
      <template #item-leading="{ item }">
        <UIcon
          v-if="item.icon"
          :name="item.icon"
          class="size-5 shrink-0"
          :class="item.iconClass"
        />
      </template>
    </UContextMenu>
  </div>
</template>
