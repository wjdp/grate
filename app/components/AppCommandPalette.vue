<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from "@nuxt/ui";
import type { GameWithProviders } from "#shared/types/Game";

const { isOpen, pane, canPopPane, pushPane, popPane, open, close } =
  useCommandPalette();
const { recentGameIds } = useRecentlyViewedGames();
const duplicateCount = useDuplicateCount();
const route = useRoute();
const toast = useToast();

const searchTerm = ref("");

// The library is only needed once the palette is used, so the fetch waits for
// the first open rather than adding a request to every page load.
const {
  data,
  status,
  execute: loadGames,
} = useFetch("/api/games", {
  key: "games",
  lazy: true,
  server: false,
  immediate: false,
});
const games = computed(() => data.value?.games ?? []);
const gamesById = computed(
  () => new Map(games.value.map((game) => [game.id, game])),
);
// Hidden games stay out of search and recents, but remain resolvable by id so a
// hidden game's own page still offers its actions.
const visibleGames = computed(() => games.value.filter((game) => !game.hidden));

watch(isOpen, (opened) => {
  if (!opened) return;
  searchTerm.value = "";
  if (status.value === "idle") loadGames();
});

watch(pane, () => {
  searchTerm.value = "";
});

const paneGame = computed(() =>
  pane.value.kind === "root"
    ? null
    : (gamesById.value.get(pane.value.gameId) ?? null),
);

const contextGame = computed(() => {
  const { id } = route.params;
  if (!route.path.startsWith("/game/") || typeof id !== "string") return null;
  return gamesById.value.get(Number(id)) ?? null;
});

const setGameState = useSetGameState();

const setGameHidden = async (game: GameWithProviders, hidden: boolean) => {
  try {
    await $fetch(`/api/games/${game.id}/hidden`, {
      method: "PATCH",
      body: { hidden },
    });
    close();
    toast.add({
      title: hidden ? "Hidden from library" : "Shown in library",
      description: game.name,
      icon: hidden ? "i-lucide-eye-off" : "i-lucide-eye",
      color: "success",
    });
    await refreshNuxtData();
  } catch (error) {
    toast.add({
      title: hidden ? "Could not hide game" : "Could not unhide game",
      description:
        error instanceof Error ? fetchErrorMessage(error) : undefined,
      icon: "i-lucide-triangle-alert",
      color: "error",
    });
  }
};

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

const toGameActionItems = (game: GameWithProviders): CommandPaletteItem[] =>
  buildGameActionCommands(game).map((action) => {
    const item: CommandPaletteItem = { label: action.label, icon: action.icon };
    if (action.id === "go-to") {
      return { ...item, onSelect: () => goTo(`/game/${game.id}`) };
    }
    if (action.id === "set-state") {
      return {
        ...item,
        onSelect: () => pushPane({ kind: "set-state", gameId: game.id }),
      };
    }
    if (action.id === "toggle-hidden") {
      return { ...item, onSelect: () => setGameHidden(game, !game.hidden) };
    }
    return {
      ...item,
      onSelect: () => {
        if (action.url) openLaunchUrl(action.url);
        close();
      },
    };
  });

const navigationItems = computed<CommandPaletteItem[]>(() =>
  buildNavigationCommands(duplicateCount.value).map(({ to, ...command }) => ({
    ...command,
    onSelect: () => goTo(to),
  })),
);

const rootGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const groups: CommandPaletteGroup<CommandPaletteItem>[] = [];
  if (contextGame.value) {
    groups.push({
      id: "context-actions",
      label: contextGame.value.name,
      items: toGameActionItems(contextGame.value),
    });
  }
  if (searchTerm.value) {
    groups.push({
      id: "games",
      label: "Games",
      items: visibleGames.value.map(toGameItem),
    });
  } else {
    const recentGames = resolveRecentGames(
      visibleGames.value,
      recentGameIds.value,
    );
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

const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const game = paneGame.value;
  if (!game) return rootGroups.value;
  if (pane.value.kind === "game-actions") {
    return [
      { id: "game-actions", label: game.name, items: toGameActionItems(game) },
    ];
  }
  return [
    {
      id: "set-state",
      label: "Set state",
      items: GAME_STATE_COMMANDS.map((command) => ({
        slot: "state",
        label: command.label,
        icon: command.icon,
        ui: { itemLeadingIcon: command.iconClass },
        current: command.state === (game.state ?? null),
        onSelect: () => {
          close();
          return setGameState(game, command.state);
        },
      })),
    },
  ];
});

const placeholder = computed(() => {
  if (pane.value.kind === "set-state") return "Set state…";
  if (paneGame.value) return `${paneGame.value.name}…`;
  return "Search games and commands";
});

const highlightedGameId = ref<number | null>(null);
const onHighlight = (payload?: { value: unknown }) => {
  const item = payload?.value as { gameId?: number } | undefined;
  highlightedGameId.value = item?.gameId ?? null;
};

// Reka owns the listbox keyboard handling, so drill-in and pane popping ride on
// the keydown events bubbling out of the palette input.
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Backspace" && !searchTerm.value && canPopPane.value) {
    event.preventDefault();
    popPane();
    return;
  }
  const caretAtEnd =
    event.target instanceof HTMLInputElement &&
    event.target.selectionStart === event.target.value.length;
  const drillsIn =
    event.key === "Tab" || (event.key === "ArrowRight" && caretAtEnd);
  if (!drillsIn || highlightedGameId.value === null) return;
  event.preventDefault();
  pushPane({ kind: "game-actions", gameId: highlightedGameId.value });
};

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
    :ui="{
      content: 'top-4 translate-y-0 sm:top-1/2 sm:-translate-y-1/2 sm:max-w-2xl',
    }"
  >
    <template #content>
      <div
        v-if="paneGame"
        class="border-default flex items-center gap-1.5 border-b px-2 py-1.5"
      >
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Back"
          @click="popPane"
        />
        <span class="text-muted truncate text-sm">{{ paneGame.name }}</span>
      </div>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
        :placeholder="placeholder"
        :loading="status === 'pending'"
        preserve-group-order
        close
        class="h-[calc(100dvh-2rem)] sm:h-96"
        :ui="{
          item: 'data-highlighted:not-data-disabled:before:bg-accented',
        }"
        @update:open="close"
        @highlight="onHighlight"
        @keydown="onKeydown"
      >
        <template #game-trailing="{ item }">
          <GameStateBadge :state="item.state" size="sm" />
        </template>
        <template #state-trailing="{ item }">
          <UIcon
            v-if="item.current"
            name="i-lucide-check"
            class="text-dimmed size-5 shrink-0"
          />
        </template>
        <template #empty>
          {{ status === "pending" ? "Loading library…" : "No matches" }}
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
