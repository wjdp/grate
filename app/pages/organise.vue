<script lang="ts" setup>
import type { ArtUrls } from "#shared/art";
import { getGameArtUrls } from "#shared/art";
import {
  type GameState,
  GameStateHues,
  GameStateIcons,
  GameStateNames,
} from "#shared/game-state";
import { getPageTitle } from "#shared/title";
import type { GameDetail } from "#shared/types/Game";

useSeoMeta({ title: getPageTitle("Organise Games") });

interface StateGroup {
  label: string;
  states: GameState[];
}

const STATE_GROUPS: StateGroup[] = [
  {
    label: "Still going",
    states: ["BACKLOG", "PLAYING", "PERIODIC", "SHELVED"],
  },
  {
    label: "Finished with",
    states: ["PLAYED", "COMPLETED", "RETIRED", "ABANDONED"],
  },
  {
    label: "Not for me",
    states: ["IGNORED"],
  },
];

const STATES_IN_DISPLAY_ORDER = STATE_GROUPS.flatMap((group) => group.states);

const shortcutKeyFor = (state: GameState) =>
  String(STATES_IN_DISPLAY_ORDER.indexOf(state) + 1);

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

const remainingCount = computed(() => gamesToOrganise.value?.length ?? 0);

const theGame = ref<GameDetail>();
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
  if (gamesToOrganise.value.length === 0) {
    organiseState.value = "empty";
    return null;
  }
  const randomIndex = Math.floor(Math.random() * gamesToOrganise.value.length);
  const { game } = await $fetch(
    `/api/games/${gamesToOrganise.value[randomIndex].id}`,
  );
  theGame.value = game;
  theArt.value = getGameArtUrls(game);
  organiseState.value = "loaded";
};

onMounted(() => {
  fetchTheGame();
});

const moveOn = async (pauseMs: number) => {
  organisedGameIds.value.push(theGame.value!.id);
  theGame.value = undefined;
  theArt.value = null;
  organiseState.value = "loading";
  await sleep(pauseMs); // to give the user a chance to see the game disappear
  await fetchTheGame();
};

const setGameState = async (state: GameState) => {
  if (!theGame.value) return;
  await $fetch(`/api/games/${theGame.value.id}/state`, {
    method: "PATCH",
    body: { state },
  });
  await moveOn(300);
};

const skipGame = async () => {
  if (!theGame.value) return;
  await moveOn(200);
};

defineShortcuts({
  ...Object.fromEntries(
    STATES_IN_DISPLAY_ORDER.map((state) => [
      shortcutKeyFor(state),
      () => setGameState(state),
    ]),
  ),
  s: skipGame,
});
</script>

<template>
  <div class="mx-auto w-full max-w-2xl">
    <div v-if="theGame" class="flex flex-col gap-6">
      <ArtHero
        :background="theArt?.background ?? null"
        :logo="theArt?.logo ?? null"
        :title="theGame.name"
      />

      <div>
        <h1
          v-if="theArt?.logo"
          class="font-display text-highlighted text-2xl font-semibold tracking-tight"
        >
          {{ theGame.name }}
        </h1>
        <p v-if="description" class="text-muted mt-2 text-sm">
          {{ description }}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <StatTile
          label="Playtime"
          icon="i-lucide-clock"
          :value="formatPlaytime(theGame.playtimeMinutes)"
        />
        <StatTile
          label="Last played"
          icon="i-lucide-calendar"
          :value="
            theGame.lastPlayedAt
              ? formatLastPlayed(theGame.lastPlayedAt)
              : 'Never'
          "
        />
      </div>

      <div
        v-for="group in STATE_GROUPS"
        :key="group.label"
        class="flex flex-col gap-2"
      >
        <p class="text-dimmed text-xs tracking-wide">{{ group.label }}</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <UButton
            v-for="state in group.states"
            :key="state"
            variant="soft"
            color="neutral"
            size="lg"
            :icon="GameStateIcons[state]"
            class="w-full"
            :ui="{ label: 'flex flex-1 items-center gap-2' }"
            @click="setGameState(state)"
          >
            <span
              :class="GameStateHues[state].dot"
              class="size-2 shrink-0 rounded-full"
              aria-hidden="true"
            />
            <span class="flex-1 text-left">{{ GameStateNames[state] }}</span>
            <UKbd :value="shortcutKeyFor(state)" />
          </UButton>
        </div>
      </div>

      <div class="flex flex-col items-center gap-2">
        <UButton variant="ghost" color="neutral" @click="skipGame">
          Skip
          <UKbd value="s" />
        </UButton>
        <p class="text-dimmed text-xs">{{ remainingCount }} left to organise</p>
      </div>
    </div>

    <div v-else-if="organiseState === 'loading'" class="flex flex-col gap-6">
      <USkeleton class="h-48 w-full rounded-lg" />
      <div class="flex flex-col gap-2">
        <USkeleton class="h-7 w-1/2" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-3/4" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <USkeleton class="h-20 rounded-lg" />
        <USkeleton class="h-20 rounded-lg" />
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        <USkeleton v-for="index in 9" :key="index" class="h-10 rounded-md" />
      </div>
    </div>

    <div
      v-else-if="organiseState === 'empty'"
      class="flex flex-col items-center gap-3 py-16 text-center"
    >
      <UIcon name="i-lucide-check-check" class="text-muted size-10" />
      <h1
        class="font-display text-highlighted text-xl font-semibold tracking-tight"
      >
        Everything is organised
      </h1>
      <UButton to="/games" color="neutral" variant="subtle">
        Back to library
      </UButton>
    </div>
  </div>
</template>
