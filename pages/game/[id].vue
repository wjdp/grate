<script lang="ts" setup>
import type { GameState } from "@prisma/client";

const { $client } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const id = parseIntRouteParam(route.params.id);
const { data } = await useGame(id);
const game = computed(() => data.value?.game);
const { data: playtimeData } = await $client.gamePlaytimes.useQuery({ id });
const playtimes = computed(() => playtimeData.value?.playtimes);
const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString();
const state = ref(game.value?.state ?? null);

const updateGameState = async (state: GameState | null) => {
  if (!game.value) throw new Error("Game not loaded");
  const previousState = game.value.state;
  game.value.state = state;
  try {
    await $client.setGameState.mutate({ id, state });
  } catch (error) {
    console.error(error);
    game.value.state = previousState;
  }
};
</script>

<template>
  <div>
    <h1 v-if="game" class="mt-2 text-2xl font-bold">
      <GameIcon :game="game" class="inline" />
      {{ game?.name ?? id }}
    </h1>
    <!-- <div v-if="game?.steamGame">
      <p>appid {{ game.steamGame.appId }}</p>
      <p>Playtime: {{ game.steamGame.playtimeForever }}</p>
    </div> -->
    <div>
      <GameStateControl v-model="state" @change="updateGameState(state)" />
      {{ state }}
    </div>
    <p v-if="game?.steamGame?.appInfo">
      {{ game.steamGame.appInfo.shortDescription }}
      <img :src="game.steamGame.appInfo.headerImage" />
    </p>
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
            {{
              playtime.timestampStart
                ? formatTimestamp(playtime.timestampStart)
                : "-"
            }}
          </td>
          <td>{{ formatTimestamp(playtime.timestampEnd) }}</td>
          <td>{{ playtime.playtimeForever }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
