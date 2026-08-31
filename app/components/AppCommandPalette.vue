<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from "@nuxt/ui";
import type { GameWithProviders } from "#shared/types/Game";

const { isOpen, open, close } = useCommandPalette();
const { recentGameIds } = useRecentlyViewedGames();
const duplicateCount = useDuplicateCount();

const searchTerm = ref("");

// The library is only needed once the palette is used, so the fetch waits for
// the first open rather than adding a request to every page load.
const {
  data,
  status,
  execute: loadGames,
} = useFetch("/api/games", {
  lazy: true,
  server: false,
  immediate: false,
});
const games = computed(() => data.value?.games ?? []);

watch(isOpen, (opened) => {
  if (!opened) return;
  searchTerm.value = "";
  if (status.value === "idle") loadGames();
});

// Items navigate through `onSelect` rather than `to`: a link item picks up the
// route-active styling, which reads as a second highlight next to the keyboard
// one whenever the palette lists the page you are already on.
const goTo = (to: string) => {
  close();
  return navigateTo(to);
};

const toGameItem = (game: GameWithProviders): CommandPaletteItem => {
  const icon = getGameIconUrl(game);
  return {
    gameId: game.id,
    slot: "game",
    label: game.name,
    state: game.state,
    avatar: icon
      ? { src: icon, alt: game.name }
      : { icon: "i-lucide-gamepad-2", alt: game.name },
    onSelect: () => goTo(`/game/${game.id}`),
  };
};

const navigationItems = computed<CommandPaletteItem[]>(() =>
  buildNavigationCommands(duplicateCount.value).map(({ to, ...command }) => ({
    ...command,
    onSelect: () => goTo(to),
  })),
);

const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const groups: CommandPaletteGroup<CommandPaletteItem>[] = [];
  if (searchTerm.value) {
    groups.push({
      id: "games",
      label: "Games",
      items: games.value.map(toGameItem),
    });
  } else {
    const recentGames = resolveRecentGames(games.value, recentGameIds.value);
    if (recentGames.length) {
      groups.push({
        id: "recent",
        label: "Recently viewed",
        items: recentGames.map(toGameItem),
      });
    }
  }
  groups.push({
    id: "navigation",
    label: "Navigation",
    items: navigationItems.value,
  });
  return groups;
});

defineShortcuts({
  meta_k: () => (isOpen.value ? close() : open()),
  "/": () => open(),
});
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Command palette"
    description="Search games, jump to a page, or act on a game"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
        placeholder="Search games and commands"
        :loading="status === 'pending'"
        preserve-group-order
        close
        class="h-96"
        :ui="{
          item: 'data-highlighted:not-data-disabled:before:bg-accented',
        }"
        @update:open="close"
      >
        <template #game-trailing="{ item }">
          <GameStateBadge :state="item.state" size="sm" />
        </template>
        <template #empty>
          {{ status === "pending" ? "Loading library…" : "No matches" }}
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
