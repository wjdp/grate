<script lang="ts" setup>
const { $client } = useNuxtApp();
const { data } = await $client.games.useQuery();
const games = computed(() => data.value?.games);
</script>

<template>
  <div>
    <h1>Games</h1>
    <ul v-if='games'>
        <li v-for='game in games' :key='game.id'>
            <NuxtLink :to='`/games/${game.id}`'>{{ game.name }}</NuxtLink>
        </li>
    </ul>
  </div>
</template>
