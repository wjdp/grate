<script lang="ts" setup>
const {data} = useFetch(() => '/api/games')
</script>

<template>
  <div>
    <h1>Games</h1>
    <ul v-if='data'>
        <li v-for='game in data.games' :key='game.id'>
            <NuxtLink :to='`/games/${game.id}`'>{{ game.name }}</NuxtLink>
        </li>
    </ul>
  </div>
</template>
