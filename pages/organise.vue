<script lang="ts" setup>
import type { GameState } from "#shared/game-state";
import { getGameArtUrls } from "#shared/art";
import type { ArtUrls } from "#shared/art";
import { getPageTitle } from "#shared/title";

useSeoMeta({ title: getPageTitle("Organise Games") });

const { data } = useFetch("/api/games");
const games = computed(() => data.value?.games);
const organisedGameIds = ref<number[]>([]);

const gamesToOrganise = computed(() =>
  games.value?.filter(
    (game) =>
      !game.state &&
      game.playtimeMinutes > 0 &&
      !organisedGameIds.value.includes(game.id),
  ),
);

const theGame = ref();
const description = computed(
  () =>
    theGame.value?.steamGames?.[0]?.appInfo?.shortDescription ??
    theGame.value?.gogGames?.[0]?.description ??
    theGame.value?.epicGames?.[0]?.description ??
    null,
);
const theArt = ref<ArtUrls | null>();
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
  const { game } = await $fetch(
    `/api/games/${gamesToOrganise.value[randomIndex].id}`,
  );
  theGame.value = game;
  theArt.value = getGameArtUrls(theGame.value);
  organiseState.value = "loaded";
};

onMounted(() => {
  fetchTheGame();
});

const setGameState = async (state: GameState) => {
  await $fetch(`/api/games/${theGame.value.id}/state`, {
    method: "PATCH",
    body: { state },
  });
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
  <div class="flex justify-center">
    <div
      v-if="theGame"
      class="my-4 max-w-xl grow border-2 border-slate-500 px-4"
      :style="{
        backgroundImage: theArt ? `url(${theArt.background})` : '',
      }"
    >
      <div class="my-4 text-center">
        <img
          v-if="theArt?.header"
          :src="theArt.header"
          :alt="`${theGame.name}`"
          class="inline-block w-full"
        />
      </div>
      <h1 class="my-4 text-center text-3xl font-semibold tracking-tight">
        {{ theGame.name }}
      </h1>
      <p v-if="description" class="my-4">
        {{ description }}
      </p>
      <div class="my-4 flex w-full flex-row space-x-4">
        <div class="basis-full">
          <p class="mb-4 text-center">
            Playtime
            <span class="font-semibold">
              {{ formatPlaytime(theGame?.playtimeMinutes ?? 0) }}
            </span>
          </p>
          <div class="flex flex-col space-y-4">
            <Button class="bg-orange-800" @click="setGameState('BACKLOG')">
              On Backlog
            </Button>
            <Button class="bg-blue-500" @click="setGameState('PLAYING')">
              Currently Playing
            </Button>
            <Button class="bg-yellow-600" @click="setGameState('PERIODIC')">
              Periodic
            </Button>
            <Button class="bg-grey-600" @click="setGameState('SHELVED')">
              Shelved
            </Button>
          </div>
        </div>
        <div class="basis-full">
          <p class="mb-4 text-center">
            Last played
            <span class="font-semibold">
              {{
                theGame?.lastPlayedAt
                  ? formatLastPlayed(theGame.lastPlayedAt)
                  : "Never"
              }}
            </span>
          </p>
          <div class="flex flex-col space-y-4">
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
      <div class="my-4">
        <Button class="bg-grey-600 w-full" @click="skipGame">Skip</Button>
      </div>
    </div>
    <div v-else-if="organiseState === 'loading'">
      <p>Loading...</p>
    </div>
    <div v-else-if="organiseState === 'empty'">
      <p>No games to organise</p>
    </div>
  </div>
</template>
