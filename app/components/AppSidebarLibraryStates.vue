<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import { GAME_STATES } from "#shared/game-state";
import type { GameWithProviders } from "#shared/types/Game";
import {
  type GameStateItem,
  gameStateItemGroups,
  unsortedGameStateItem,
} from "~/utils/gameStateItems";

defineProps<{ collapsed?: boolean }>();

const route = useRoute();

const { data } = useFetch("/api/games", { key: "games" });

const visibleGames = computed<GameWithProviders[]>(() =>
  (data.value?.games ?? []).filter((game) => !game.hidden),
);

const counts = computed(() => {
  const byState = new Map<string, number>();
  for (const game of visibleGames.value) {
    const key = game.state ?? "unsorted";
    byState.set(key, (byState.get(key) ?? 0) + 1);
  }
  return byState;
});

const STATE_FILTERS = ["unsorted", ...GAME_STATES] as const;

const selected = computed(() => {
  const raw = route.query.state;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return STATE_FILTERS.includes(value as (typeof STATE_FILTERS)[number])
    ? (value as string)
    : "all";
});

const allItem = {
  value: "all",
  label: "All",
  icon: "i-lucide-layers",
  iconClass: "text-muted",
};

function navItem(
  item: Pick<GameStateItem, "label" | "icon" | "iconClass">,
  value: string,
  count: number,
): NavigationMenuItem {
  const query = { ...route.query };
  if (value === "all") delete query.state;
  else query.state = value;

  return {
    label: item.label,
    icon: item.icon,
    badge: count,
    active: selected.value === value,
    to: { path: "/games", query },
    ui: { linkLeadingIcon: item.iconClass },
  };
}

const itemGroups = computed<NavigationMenuItem[][]>(() => {
  const groups: NavigationMenuItem[][] = [
    [
      navItem(allItem, "all", visibleGames.value.length),
      navItem(
        unsortedGameStateItem,
        "unsorted",
        counts.value.get("unsorted") ?? 0,
      ),
    ],
  ];

  for (const group of gameStateItemGroups) {
    const items = group
      .filter((item) => item.value !== null)
      .filter(
        (item) =>
          (counts.value.get(item.value as string) ?? 0) > 0 ||
          selected.value === item.value,
      )
      .map((item) =>
        navItem(
          item,
          item.value as string,
          counts.value.get(item.value as string) ?? 0,
        ),
      );
    if (items.length) groups.push(items);
  }

  return groups;
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <UNavigationMenu
      v-for="(items, index) in itemGroups"
      :key="index"
      :items="items"
      :collapsed="collapsed"
      orientation="vertical"
      tooltip
      :ui="{
        link: collapsed
          ? 'px-2 before:bg-accented'
          : 'ps-6 pe-2 before:bg-accented',
      }"
    />
  </div>
</template>
