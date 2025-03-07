<script lang="ts" setup>
const { $client } = useNuxtApp();
const { data } = $client.games.useQuery();
const games = computed(() => data.value?.games);
type FilterOption = "all" | "played" | "unplayed" | "recent";
const filter = ref<FilterOption>("all");
const filteredGames = computed(() => {
  return games.value?.filter((game) => {
    if (filter.value === "played") return game.steamGame?.playtimeForever > 0;
    if (filter.value === "unplayed")
      return game.steamGame?.playtimeForever === 0;
    if (filter.value === "recent") return game.steamGame?.playtime2weeks > 0;
    return true;
  });
});

type SortOption = "name" | "playtime";
const sort = ref<SortOption>("name");
const sortedGames = computed(() => {
  return filteredGames.value?.sort((a, b) => {
    if (sort.value === "name") return a.name.localeCompare(b.name);
    if (sort.value === "playtime")
      return (
        (b.steamGame?.playtimeForever ?? 0) -
        (a.steamGame?.playtimeForever ?? 0)
      );
    return 0;
  });
});

const totalPlaytime = computed(() => {
  return games.value?.reduce((acc, game) => {
    return acc + (game.steamGame?.playtimeForever ?? 0);
  }, 0);
});
const totalPlaytimeFormatted = computed(() => {
  if (!totalPlaytime.value) return "";
  return formatPlaytime(totalPlaytime.value);
});
const totalGames = computed(() => games.value?.length);
const totalPlayedGames = computed(() => {
  return games.value?.filter((game) => game.steamGame?.playtimeForever > 0)
    .length;
});
const totalUnplayedGames = computed(() => {
  return games.value?.filter((game) => game.steamGame?.playtimeForever === 0)
    .length;
});
const totalRecentGames = computed(() => {
  return games.value?.filter((game) => game.steamGame?.playtime2weeks > 0)
    .length;
});
</script>

<template>
  <div>
    <h1 class="mt-2 text-2xl font-bold">Games</h1>
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
