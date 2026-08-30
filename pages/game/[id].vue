<script lang="ts" setup>
import type { GameState } from "#shared/game-state";
import { getGameArtUrls } from "#shared/art";
import { getPageTitle } from "#shared/title";

const { $client } = useNuxtApp();
const route = useRoute();
const id = parseIntRouteParam(route.params.id);
const { data, refresh } = await useGame(id);
const game = computed(() => data.value?.game);

if (game.value) useSeoMeta({ title: getPageTitle(game.value.name) });

const { data: playtimeData, refresh: refreshPlaytimes } =
  await $client.gamePlaytimes.useQuery({ id });
const playtimes = computed(() => playtimeData.value?.playtimes);
const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString();
const state = ref(game.value?.state ?? null);
watch(
  () => game.value?.state,
  (updatedState) => {
    state.value = updatedState ?? null;
  },
);

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

const onMerged = async () => {
  await Promise.all([refresh(), refreshPlaytimes()]);
};

const steamGames = computed(() => game.value?.steamGames ?? []);
const gogGames = computed(() => game.value?.gogGames ?? []);

const description = computed(
  () =>
    steamGames.value[0]?.appInfo?.shortDescription ??
    gogGames.value[0]?.description ??
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
    <GameProviderRows v-if="game" :game="game" />
    <GameMergeDialog v-if="game" :game="game" @merged="onMerged" />
    <table v-if="playtimes" class="my-4">
      <thead>
        <tr>
          <th>Start</th>
          <th>End</th>
          <th>Provider</th>
          <th>Name</th>
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
          <td class="p-1">{{ playtime.providerName }}</td>
          <td class="p-1">{{ playtime.playtimeMinutes }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
