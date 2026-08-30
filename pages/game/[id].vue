<script lang="ts" setup>
import type { GameState } from "#shared/game-state";
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

const openSteamGame = () => {
  window.open(
    `steam://nav/games/details/${game.value?.steamGame?.appId}`,
    "_self",
  );
};

const openGogGame = () => {
  window.open(
    `goggalaxy://openGameView/${game.value?.gogGame?.gogId}`,
    "_self",
  );
};

const description = computed(
  () =>
    game.value?.steamGame?.appInfo?.shortDescription ??
    game.value?.gogGame?.description ??
    null,
);
</script>

<template>
  <div class="p-4">
    <h1 v-if="game" class="text-2xl font-bold">
      <GameIcon :game="game" class="inline" />
      {{ game?.name ?? id }}
    </h1>
    <div class="my-4">
      <GameStateControl v-model="state" @change="updateGameState(state)" />
      {{ state }}
    </div>
    <p v-if="description" class="my-4">
      {{ description }}
      <img v-if="art?.header" :src="art.header" />
    </p>
    <div v-if="game?.steamGame" class="my-4">
      <Button @click="openSteamGame" class="mr-2">Open in Steam</Button>
      <PlayButton :href="`steam://run/${game.steamGame.appId}`" />
    </div>
    <div v-else-if="game?.gogGame" class="my-4">
      <Button @click="openGogGame" class="mr-2">Open in GOG</Button>
      <PlayButton :href="`goggalaxy://runGame/${game.gogGame.gogId}`" />
    </div>
    <table v-if="playtimes" class="my-4">
      <thead>
        <tr>
          <th>Start</th>
          <th>End</th>
          <th>Provider</th>
          <th>Running total</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(playtime, i) in playtimes"
          :key="i"
          :class="{
            'text-grey-500':
              playtimes[i + 1]?.playtimeMinutes == playtime.playtimeMinutes,
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
          <td class="p-1">{{ playtime.provider }}</td>
          <td class="p-1">{{ playtime.playtimeMinutes }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
