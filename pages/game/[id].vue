<script lang="ts" setup>
import type { GameState } from "@prisma/client";
import { getGameArtUrls } from "#shared/art";
import { coerce } from "zod";
import { getPageTitle } from "#shared/title";

const { $client } = useNuxtApp();
const route = useRoute();
const id = parseIntRouteParam(route.params.id);
const { data } = await useGame(id);
const game = computed(() => data.value?.game);

if (game.value) useSeoMeta({ title: getPageTitle(game.value.name) });

const { data: playtimeData } = await $client.gamePlaytimes.useQuery({ id });
const playtimes = computed(() => playtimeData.value?.playtimes);
const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString();
const state = ref(game.value?.state ?? null);

const art = computed(() => game.value && getGameArtUrls(game.value));

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
  <div class="p-4">
    <h1 v-if="game" class="text-2xl font-bold">
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
      <img v-if="art" :src="art.header" />
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
        <tr
          v-for="(playtime, i) in playtimes"
          :key="playtime.id"
          :class="{
            'text-grey-500':
              playtimes[i + 1]?.playtimeForever == playtime.playtimeForever,
          }"
        >
          <td class="p-1">
            {{
              playtime.timestampStart
                ? formatTimestamp(playtime.timestampStart)
                : "-"
            }}
          </td>
          <td class="p-1">{{ formatTimestamp(playtime.timestampEnd) }}</td>
          <td class="p-1">{{ playtime.playtimeForever }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
