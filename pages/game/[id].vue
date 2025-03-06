<script lang="ts" setup>
const { $client } = useNuxtApp();
const route = useRoute();
const id = parseIntRouteParam(route.params.id);
const { data } = await $client.game.useQuery({ id });
const game = computed(() => data.value?.game);
const { data: playtimeData} = await $client.gamePlaytimes.useQuery({ id });
const playtimes = computed(() => playtimeData.value?.playtimes);
const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleString();
</script>

<template>
  <div>
    <h1>
      <GameIcon :game='game' />
      {{game?.name ?? id}}
    </h1>
    <div v-if="game?.steamGame">
      <p>appid {{game.steamGame.appId}}</p>
      <p>Playtime: {{game.steamGame.playtimeForever}}</p>
    </div>
    <table v-if="playtimes">
      <thead>
        <tr>
          <th>Start</th>
          <th>End</th>
          <th>Running total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="playtime in playtimes" :key="playtime.id">
          <td>
            {{ playtime.timestampStart ? formatTimestamp(playtime.timestampStart) : '-'}}
          </td>
          <td>{{formatTimestamp(playtime.timestampEnd)}}</td>
          <td>{{playtime.playtimeForever}}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
