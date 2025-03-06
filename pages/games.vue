<script lang="ts" setup>
const { $client } = useNuxtApp();
const { data } = await $client.games.useQuery();
const games = computed(() => data.value?.games);
type FilterOption = 'all' | 'played' | 'unplayed' | 'recent';
const filter = ref<FilterOption>('all');
const filteredGames = computed(() => {
  return games.value?.filter((game) => {
    if (filter.value === 'played') return game.steamGame?.playtimeForever > 0;
    if (filter.value === 'unplayed') return game.steamGame?.playtimeForever === 0;
    if (filter.value === 'recent') return game.steamGame?.playtime2weeks > 0;
    return true;
  });
});
</script>

<template>
  <div>
    <h1>Games</h1>
    <select v-model='filter'>
        <option value='all'>All</option>
        <option value='played'>Played</option>
        <option value='unplayed'>Unplayed</option>
        <option value='recent'>Recent</option>
    </select>
    <ul v-if='filteredGames'>
        <GameTile v-for='game in filteredGames' :key='game.id' :game="game" />
    </ul>
  </div>
</template>
