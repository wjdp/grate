<script lang="ts" setup>
import { getPageTitle } from "#shared/title";

useSeoMeta({ title: getPageTitle("Games") });
const { data } = useFetch("/api/games");
const games = computed(() => data.value?.games);
type FilterOption = "all" | "played" | "unplayed" | "recent";
const filter = ref<FilterOption>("all");

const RECENT_DAYS = 14;
const isRecentlyPlayed = (lastPlayedAt: Date | string | null) => {
  if (!lastPlayedAt) return false;
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  return new Date(lastPlayedAt).getTime() >= cutoff;
};

const filteredGames = computed(() => {
  return games.value?.filter((game) => {
    if (filter.value === "played") return game.playtimeMinutes > 0;
    if (filter.value === "unplayed") return game.playtimeMinutes === 0;
    if (filter.value === "recent") return isRecentlyPlayed(game.lastPlayedAt);
    return true;
  });
});

type SortOption = "name" | "playtime";
const sort = ref<SortOption>("name");
const sortedGames = computed(() => {
  return filteredGames.value?.sort((a, b) => {
    if (sort.value === "name") return a.name.localeCompare(b.name);
    if (sort.value === "playtime") return b.playtimeMinutes - a.playtimeMinutes;
    return 0;
  });
});

const totalPlaytime = computed(() => {
  return games.value?.reduce((acc, game) => acc + game.playtimeMinutes, 0);
});
const totalPlaytimeFormatted = computed(() => {
  if (!totalPlaytime.value) return "";
  return formatPlaytime(totalPlaytime.value);
});
const totalGames = computed(() => games.value?.length);
const totalPlayedGames = computed(() => {
  return games.value?.filter((game) => game.playtimeMinutes > 0).length;
});
const totalUnplayedGames = computed(() => {
  return games.value?.filter((game) => game.playtimeMinutes === 0).length;
});
const totalRecentGames = computed(() => {
  return games.value?.filter((game) => isRecentlyPlayed(game.lastPlayedAt))
    .length;
});
</script>

<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold">Games</h1>
    <div class="my-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <p>Total playtime: {{ totalPlaytimeFormatted }}</p>
      <p>Total games: {{ totalGames }}</p>
      <p>Played games: {{ totalPlayedGames }}</p>
      <p>Unplayed games: {{ totalUnplayedGames }}</p>
      <p>Recent games: {{ totalRecentGames }}</p>
    </div>
    <p class="my-2">
      Sort:
      <select v-model="sort" class="bg-slate-700 p-1">
        <option value="name">Name</option>
        <option value="playtime">Playtime</option>
      </select>
      Filter:
      <select v-model="filter" class="bg-slate-700 p-1">
        <option value="all">All</option>
        <option value="played">Played</option>
        <option value="unplayed">Unplayed</option>
        <option value="recent">Recent</option>
      </select>
    </p>
    <ul
      v-if="sortedGames"
      class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <GameTile v-for="game in filteredGames" :key="game.id" :game="game" />
    </ul>
  </div>
</template>
