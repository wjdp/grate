<script lang="ts" setup>
import {
  GAME_STATES,
  type GameState,
  GameStateHues,
  GameStateNames,
} from "#shared/game-state";
import { getPageTitle } from "#shared/title";
import type { GameWithProviders } from "#shared/types/Game";

useSeoMeta({ title: getPageTitle("Library") });

const { data } = await useFetch("/api/games");
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
const PROVIDER_FILTERS = ["all", "steam", "gog", "epic"] as const;
const PLAYED_FILTERS = ["all", "played", "unplayed", "recent"] as const;
const SORTS = ["name", "playtime", "lastPlayed"] as const;

const search = queryParam("q", "");
const stateFilter = queryParam("state", "all", STATE_FILTERS);
const providerFilter = queryParam("provider", "all", PROVIDER_FILTERS);
const playedFilter = queryParam("played", "all", PLAYED_FILTERS);
const sort = queryParam("sort", "name", SORTS);

const view = useCookie<"wall" | "list">("library-view", {
  default: () => "wall",
});

interface FilterItem {
  value: string;
  label: string;
  dot?: string;
}

const stateItems: FilterItem[] = [
  { value: "all", label: "All states" },
  { value: "unsorted", label: "Unsorted" },
  ...GAME_STATES.map((state) => ({
    value: state,
    label: GameStateNames[state],
    dot: GameStateHues[state].dot,
  })),
];

const providerItems: FilterItem[] = [
  { value: "all", label: "All providers" },
  { value: "steam", label: "Steam" },
  { value: "gog", label: "GOG" },
  { value: "epic", label: "Epic" },
];

const playedItems: FilterItem[] = [
  { value: "all", label: "Played and unplayed" },
  { value: "played", label: "Played" },
  { value: "unplayed", label: "Unplayed" },
  { value: "recent", label: "Played recently" },
];

const sortItems: FilterItem[] = [
  { value: "name", label: "Name" },
  { value: "playtime", label: "Playtime" },
  { value: "lastPlayed", label: "Last played" },
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

const filteredGames = computed(() =>
  games.value.filter(
    (game) =>
      matchesState(game) &&
      matchesPlayed(game) &&
      hasProvider(game, providerFilter.value) &&
      game.name.toLowerCase().includes(search.value.trim().toLowerCase()),
  ),
);

const sortedGames = computed(() =>
  [...filteredGames.value].sort((a, b) => {
    if (sort.value === "playtime") return b.playtimeMinutes - a.playtimeMinutes;
    if (sort.value === "lastPlayed") {
      const at = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
      const bt = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
      return bt - at;
    }
    return a.name.localeCompare(b.name);
  }),
);

const totalPlaytime = computed(() =>
  games.value.reduce((total, game) => total + game.playtimeMinutes, 0),
);
const playedCount = computed(
  () => games.value.filter((game) => game.playtimeMinutes > 0).length,
);
const recentCount = computed(
  () =>
    games.value.filter((game) => isRecentlyPlayed(game.lastPlayedAt)).length,
);

const stats = computed(() => [
  {
    label: "Total playtime",
    value: formatPlaytime(totalPlaytime.value) || "0m",
  },
  { label: "Games", value: games.value.length },
  { label: "Played", value: playedCount.value },
  { label: "Unplayed", value: games.value.length - playedCount.value },
  { label: "Played recently", value: recentCount.value },
]);

const hasFilters = computed(
  () =>
    !!search.value ||
    stateFilter.value !== "all" ||
    providerFilter.value !== "all" ||
    playedFilter.value !== "all",
);

const clearFilters = () => {
  router.replace({ query: {} });
};
</script>

<template>
  <div class="space-y-6">
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
        :items="stateItems"
        value-key="value"
        :search-input="false"
        class="w-40"
      >
        <template #item-leading="{ item }">
          <span
            v-if="item.dot"
            :class="['size-2 shrink-0 rounded-full', item.dot]"
          />
        </template>
      </USelectMenu>
      <USelectMenu
        v-model="providerFilter"
        :items="providerItems"
        value-key="value"
        :search-input="false"
        class="w-40"
      />
      <USelectMenu
        v-model="playedFilter"
        :items="playedItems"
        value-key="value"
        :search-input="false"
        class="w-48"
      />
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
        No games match
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
  </div>
</template>
