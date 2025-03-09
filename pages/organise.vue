<script lang="ts" setup>
import type { GameState } from "@prisma/client";

const { $client } = useNuxtApp();
const { data } = useGames();
const games = computed(() => data.value?.games);
const organisedGameIds = ref<number[]>([]);

const gamesToOrganise = computed(() =>
  games.value?.filter(
    (game) =>
      !game.state &&
      (game.steamGame?.playtimeForever ?? 0) > 0 &&
      !organisedGameIds.value.includes(game.id),
  ),
);

const theGame = ref();
const organiseState = ref<"loading" | "empty" | "loaded">("loading");

const fetchTheGame = async () => {
  if (!gamesToOrganise.value) {
    return null;
  }
  if (gamesToOrganise.value?.length === 0) {
    organiseState.value = "empty";
    return null;
  }
  const lengthOfArray = gamesToOrganise.value.length;
  const randomIndex = Math.floor(Math.random() * lengthOfArray);
  const response = await $client.game.query({
    id: gamesToOrganise.value[randomIndex].id,
  });
  theGame.value = response.game;
  organiseState.value = "loaded";
};

onMounted(() => {
  fetchTheGame();
});

const setGameState = async (state: GameState) => {
  await $client.setGameState.mutate({ id: theGame.value.id, state });
  organisedGameIds.value.push(theGame.value.id);
  theGame.value = undefined;
  organiseState.value = "loading";
  await sleep(300); // to give the user a chance to see the game disappear
  await fetchTheGame();
};

const skipGame = async () => {
  organisedGameIds.value.push(theGame.value.id);
  theGame.value = undefined;
  organiseState.value = "loading";
  await sleep(200); // to give the user a chance to see the game disappear
  await fetchTheGame();
};
</script>

<template>
  <main>
    <h1>Organise</h1>
    <div v-if="theGame" class="my-4 max-w-xl border-2 border-slate-500 px-4">
      <div class="py-2 text-center">
        <img
          v-if="theGame.steamGame.appInfo"
          :src="theGame.steamGame.appInfo.headerImage"
          :alt="`${theGame.name}`"
          class="inline-block"
        />
      </div>
      <h1 class="py-2 text-center text-3xl font-light tracking-tight">
        {{ theGame.name }}
      </h1>
      <p>{{ theGame.state }}</p>
      <p v-if="theGame.steamGame?.appInfo" class="py-1">
        {{ theGame.steamGame.appInfo.shortDescription }}
      </p>
      <div class="flex flex-row py-1 text-center">
        <p class="grow">
          Playtime
          <span class="font-semibold">
            {{ formatPlaytime(theGame?.steamGame?.playtimeForever) }}
          </span>
        </p>
        <p class="grow">
          Last played
          <span class="font-semibold">
            {{ formatLastPlayed(theGame?.steamGame?.rTimeLastPlayed) }}
          </span>
        </p>
      </div>
      <div class="flex w-full flex-row space-x-4">
        <div class="basis-full">
          <h2 class="font-lg py-2 text-center font-bold">Playing</h2>
          <div class="flex flex-col space-y-2">
            <Button class="bg-orange-800" @click="setGameState('BACKLOG')">
              On Backlog
            </Button>
            <Button class="bg-blue-500" @click="setGameState('PLAYING')">
              Currently Playing
            </Button>
            <Button class="bg-yellow-600" @click="setGameState('PERIODIC')">
              Periodic
            </Button>
            <Button class="bg-gray-600" @click="setGameState('SHELVED')">
              Shelved
            </Button>
          </div>
        </div>
        <div class="basis-full">
          <h2 class="font-lg py-2 text-center font-bold">Finished</h2>
          <div class="flex flex-col space-y-2">
            <Button class="bg-cyan-600" @click="setGameState('PLAYED')">
              Played
            </Button>
            <Button class="bg-green-600" @click="setGameState('COMPLETED')">
              Completed
            </Button>
            <Button class="bg-yellow-800" @click="setGameState('RETIRED')">
              Retired
            </Button>
            <Button class="bg-red-900" @click="setGameState('ABANDONED')">
              Abandoned
            </Button>
          </div>
        </div>
      </div>
      <div class="py-4">
        <Button class="w-full bg-gray-800" @click="skipGame">Skip</Button>
      </div>
    </div>
    <div v-else-if="organiseState === 'loading'">
      <p>Loading...</p>
    </div>
    <div v-else-if="organiseState === 'empty'">
      <p>No games to organise</p>
    </div>
  </main>
</template>
