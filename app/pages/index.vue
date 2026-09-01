<script setup lang="ts">
import { getPageTitle } from "#shared/title";

useSeoMeta({ title: getPageTitle("Home") });

const { data: setupData } = await useFetch("/api/setup");
const { data: recentGamesData } = await useFetch("/api/games/recent", {
  query: { limit: 6 },
});
const { data: gamesData } = await useFetch("/api/games", { key: "games" });
const { data: duplicateCount } = await useFetch("/api/games/duplicates", {
  transform: (data) => data.pairs.length,
});

const needsProvider = computed(
  () => !!setupData.value && !setupData.value.user,
);
const recentGames = computed(() => recentGamesData.value?.games ?? []);
const unsortedPlayedCount = computed(
  () =>
    (gamesData.value?.games ?? []).filter(
      (game) => !game.hidden && !game.state && game.playtimeMinutes > 0,
    ).length,
);
</script>

<template>
  <PageContainer class="max-w-7xl space-y-8">
    <UAlert
      v-if="needsProvider"
      color="neutral"
      variant="soft"
      icon="i-lucide-plug"
      title="grate needs a provider"
      description="Connect Steam, GOG or Epic to import your library."
      :actions="[
        {
          label: 'Connect a provider',
          to: '/providers',
          color: 'primary',
          variant: 'solid',
        },
      ]"
    />

    <section class="space-y-4">
      <h2
        class="font-display text-highlighted text-xl font-semibold tracking-tight"
      >
        Continue playing
      </h2>
      <div
        v-if="recentGames.length"
        class="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]"
      >
        <GamePoster v-for="game in recentGames" :key="game.id" :game="game" />
      </div>
      <p v-else class="text-muted text-sm">
        Nothing played yet — play something and it shows up here.
      </p>
    </section>

    <UCard v-if="unsortedPlayedCount > 0">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-highlighted font-medium">
            {{ unsortedPlayedCount }} played
            {{ unsortedPlayedCount === 1 ? "game is" : "games are" }} unsorted
          </p>
          <p class="text-muted text-sm">
            Give them a state so your library stays useful.
          </p>
        </div>
        <UButton to="/organise" color="primary" icon="i-lucide-list-checks">
          Organise them
        </UButton>
      </div>
    </UCard>

    <UCard v-if="duplicateCount && duplicateCount > 0">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-highlighted font-medium">
            {{ duplicateCount }} possible duplicate
            {{ duplicateCount === 1 ? "record" : "records" }} in your library
          </p>
          <p class="text-muted text-sm">
            The same game may be listed more than once across providers.
          </p>
        </div>
        <UButton to="/duplicates" color="primary" icon="i-lucide-copy">
          Review them
        </UButton>
      </div>
    </UCard>
  </PageContainer>
</template>
