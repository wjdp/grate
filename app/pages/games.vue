<script lang="ts" setup>
import { GAME_STATES, type GameState } from "#shared/game-state";
import { PROVIDERS } from "#shared/providers";
import { getPageTitle } from "#shared/title";
import type { GameWithProviders } from "#shared/types/Game";
import { gameStateItemGroups } from "~/utils/gameStateItems";

useSeoMeta({ title: getPageTitle("Library") });

const { data } = await useFetch("/api/games", { key: "games" });
const games = computed(() => data.value?.games ?? []);

const route = useRoute();
const router = useRouter();

function queryParam<Value extends string>(
  key: string,
  fallback: Value,
  allowed?: readonly Value[],
) {
  return computed<Value>({
    get() {
      const raw = route.query[key];
      const value = (Array.isArray(raw) ? raw[0] : raw) ?? "";
      if (allowed && !allowed.includes(value as Value)) return fallback;
      return (value || fallback) as Value;
    },
    set(value) {
      const query = { ...route.query };
      if (!value || value === fallback) delete query[key];
      else query[key] = value;
      router.replace({ query });
    },
  });
}

const STATE_FILTERS = ["all", "unsorted", ...GAME_STATES] as const;
const PROVIDER_FILTERS = ["all", ...PROVIDERS] as const;
const PLAYED_FILTERS = ["all", "played", "unplayed", "recent"] as const;
const HIDDEN_FILTERS = ["all", "hidden"] as const;
const SORTS = ["lastPlayed", "name", "playtime"] as const;

const search = queryParam("q", "");
const stateFilter = queryParam("state", "all", STATE_FILTERS);
const providerFilter = queryParam("provider", "all", PROVIDER_FILTERS);
const playedFilter = queryParam("played", "all", PLAYED_FILTERS);
const hiddenFilter = queryParam("hidden", "all", HIDDEN_FILTERS);
const sort = queryParam("sort", "lastPlayed", SORTS);

const view = useCookie<"wall" | "list">("library-view", {
  default: () => "wall",
});

interface FilterItem {
  value: string;
  label: string;
}

interface StateFilterItem extends FilterItem {
  icon: string;
  iconClass: string;
}

const allStatesItem: StateFilterItem = {
  value: "all",
  label: "All states",
  icon: "i-lucide-layers",
  iconClass: "text-muted",
};

const stateFilterGroups: StateFilterItem[][] = [
  [allStatesItem],
  ...gameStateItemGroups.map((group) =>
    group.map((item) => ({ ...item, value: item.value ?? "unsorted" })),
  ),
];

const stateFilterItems = stateFilterGroups.flat();

const selectedStateItem = computed(
  () =>
    stateFilterItems.find((item) => item.value === stateFilter.value) ??
    allStatesItem,
);

const playedItems: FilterItem[] = [
  { value: "all", label: "Played and unplayed" },
  { value: "played", label: "Played" },
  { value: "unplayed", label: "Unplayed" },
  { value: "recent", label: "Played recently" },
];

const hiddenItems: FilterItem[] = [
  { value: "all", label: "Visible" },
  { value: "hidden", label: "Hidden" },
];

const sortItems: FilterItem[] = [
  { value: "lastPlayed", label: "Last played" },
  { value: "name", label: "Name" },
  { value: "playtime", label: "Playtime" },
];

const RECENT_DAYS = 14;
const isRecentlyPlayed = (lastPlayedAt: string | null) => {
  if (!lastPlayedAt) return false;
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  return new Date(lastPlayedAt).getTime() >= cutoff;
};

const hasProvider = (game: GameWithProviders, provider: string) => {
  if (provider === "steam") return game.steamGames.length > 0;
  if (provider === "gog") return game.gogGames.length > 0;
  if (provider === "epic") return game.epicGames.length > 0;
  return true;
};

const matchesState = (game: GameWithProviders) => {
  if (stateFilter.value === "all") return true;
  if (stateFilter.value === "unsorted") return !game.state;
  return game.state === (stateFilter.value as GameState);
};

const matchesPlayed = (game: GameWithProviders) => {
  if (playedFilter.value === "played") return game.playtimeMinutes > 0;
  if (playedFilter.value === "unplayed") return game.playtimeMinutes === 0;
  if (playedFilter.value === "recent")
    return isRecentlyPlayed(game.lastPlayedAt);
  return true;
};

const matchesHidden = (game: GameWithProviders) =>
  hiddenFilter.value === "hidden" ? game.hidden : !game.hidden;

const filteredGames = computed(() =>
  games.value.filter(
    (game) =>
      matchesHidden(game) &&
      matchesState(game) &&
      matchesPlayed(game) &&
      hasProvider(game, providerFilter.value) &&
      game.name.toLowerCase().includes(search.value.trim().toLowerCase()),
  ),
);

const sortedGames = computed(() =>
  [...filteredGames.value].sort((a, b) => {
    if (sort.value === "playtime")
      return (
        b.playtimeMinutes - a.playtimeMinutes || a.name.localeCompare(b.name)
      );
    if (sort.value === "lastPlayed") {
      const at = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
      const bt = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
      return bt - at || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  }),
);

// Stats always describe the visible library, whatever the hidden filter shows.
const visibleGames = computed(() => games.value.filter((game) => !game.hidden));

const totalPlaytime = computed(() =>
  visibleGames.value.reduce((total, game) => total + game.playtimeMinutes, 0),
);
const playedCount = computed(
  () => visibleGames.value.filter((game) => game.playtimeMinutes > 0).length,
);
const recentCount = computed(
  () =>
    visibleGames.value.filter((game) => isRecentlyPlayed(game.lastPlayedAt))
      .length,
);

const stats = computed(() => [
  {
    label: "Total playtime",
    value: formatPlaytime(totalPlaytime.value) || "0m",
  },
  { label: "Games", value: visibleGames.value.length },
  { label: "Played", value: playedCount.value },
  { label: "Unplayed", value: visibleGames.value.length - playedCount.value },
  { label: "Played recently", value: recentCount.value },
]);

const hasHiddenGames = computed(() => games.value.some((game) => game.hidden));

const emptyResultTitle = computed(() =>
  hiddenFilter.value === "hidden" && !hasHiddenGames.value
    ? "No hidden games"
    : "No games match",
);

const hasFilters = computed(
  () =>
    !!search.value ||
    stateFilter.value !== "all" ||
    providerFilter.value !== "all" ||
    playedFilter.value !== "all" ||
    hiddenFilter.value !== "all",
);

const clearFilters = () => {
  router.replace({ query: {} });
};
</script>

<template>
  <PageContainer class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1
        class="font-display text-highlighted text-2xl font-semibold tracking-tight"
      >
        Library
      </h1>
      <div class="flex items-center gap-2">
        <UFieldGroup>
          <UButton
            icon="i-lucide-layout-grid"
            :variant="view === 'wall' ? 'solid' : 'outline'"
            :color="view === 'wall' ? 'primary' : 'neutral'"
            aria-label="Poster wall"
            @click="view = 'wall'"
          />
          <UButton
            icon="i-lucide-list"
            :variant="view === 'list' ? 'solid' : 'outline'"
            :color="view === 'list' ? 'primary' : 'neutral'"
            aria-label="List"
            @click="view = 'list'"
          />
        </UFieldGroup>
      </div>
    </div>

    <dl
      class="border-default divide-default flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-2.5 sm:gap-x-6 sm:divide-x"
    >
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="flex items-baseline gap-1.5 sm:pe-6 sm:last:pe-0"
      >
        <dd
          class="font-display text-highlighted text-sm font-semibold tabular-nums"
        >
          {{ stat.value }}
        </dd>
        <dt class="text-muted text-xs">{{ stat.label }}</dt>
      </div>
    </dl>

    <div class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search games"
        class="w-full sm:w-64"
      />
      <USelectMenu
        v-model="stateFilter"
        :items="stateFilterGroups"
        value-key="value"
        :search-input="false"
        :ui="{
          content:
            'max-h-[min(24rem,var(--reka-combobox-content-available-height,24rem))]',
        }"
        class="w-40"
      >
        <template #leading>
          <UIcon
            :name="selectedStateItem.icon"
            class="size-5 shrink-0"
            :class="selectedStateItem.iconClass"
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
      <ProviderSelect v-model="providerFilter" class="w-40" />
      <USelectMenu
        v-model="playedFilter"
        :items="playedItems"
        value-key="value"
        :search-input="false"
        class="w-48"
      />
      <USelectMenu
        v-model="hiddenFilter"
        :items="hiddenItems"
        value-key="value"
        :search-input="false"
        class="w-32"
      >
        <template #leading>
          <UIcon
            :name="
              hiddenFilter === 'hidden' ? 'i-lucide-eye-off' : 'i-lucide-eye'
            "
            class="text-muted size-5 shrink-0"
          />
        </template>
      </USelectMenu>
      <USelectMenu
        v-model="sort"
        :items="sortItems"
        value-key="value"
        :search-input="false"
        icon="i-lucide-arrow-up-down"
        class="ms-auto w-40"
      />
    </div>

    <div
      v-if="games.length === 0"
      class="border-default flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center"
    >
      <UIcon name="i-lucide-library-big" class="text-dimmed size-10" />
      <p class="font-display text-highlighted text-lg font-semibold">
        No games yet
      </p>
      <p class="text-muted text-sm">
        Connect a provider to import your library
      </p>
      <UButton to="/providers" color="primary" icon="i-lucide-plug">
        Connect a provider
      </UButton>
    </div>

    <div
      v-else-if="sortedGames.length === 0"
      class="border-default flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center"
    >
      <UIcon name="i-lucide-search-x" class="text-dimmed size-10" />
      <p class="font-display text-highlighted text-lg font-semibold">
        {{ emptyResultTitle }}
      </p>
      <UButton
        v-if="hasFilters"
        color="neutral"
        variant="outline"
        @click="clearFilters"
      >
        Clear filters
      </UButton>
    </div>

    <VirtualGameWall v-else-if="view === 'wall'" :games="sortedGames" />

    <VirtualGameList v-else :games="sortedGames" />
  </PageContainer>
</template>
