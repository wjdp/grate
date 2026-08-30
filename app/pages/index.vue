<script setup lang="ts">
import { getGameArtUrls } from "#shared/art";

const appConfig = useAppConfig();
const { data: setupData } = useFetch(() => "/api/setup");
const { data: recentGamesData } = useFetch("/api/games/recent", {
  query: { limit: 6 },
});

const recentGames = computed(() => recentGamesData.value?.games || []);
</script>

<template>
  <div class="p-4">
    <div class="mb-8">
      <h1 class="mb-2 text-3xl font-bold">Welcome to {{ appConfig.title }}</h1>
      <p v-if="setupData && setupData.user" class="text-muted">Ready to play</p>
      <p v-if="setupData && !setupData.user" class="text-yellow-400">
        grate needs setup
      </p>
    </div>

    <div v-if="recentGames.length > 0" class="mb-8">
      <h2 class="mb-4 text-2xl font-semibold">Recently Played</h2>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div
          v-for="game in recentGames"
          :key="game.id"
          class="group cursor-pointer"
        >
          <NuxtLink :to="`/game/${game.id}`" class="block">
            <div
              class="bg-elevated relative mb-2 aspect-[3/4] overflow-hidden rounded-lg"
            >
              <img
                v-if="getGameArtUrls(game)?.poster"
                :src="getGameArtUrls(game)?.poster ?? undefined"
                :alt="game.name"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div
                v-else
                class="text-dimmed flex h-full w-full items-center justify-center"
              >
                <Icon name="heroicons:photo" class="h-8 w-8" />
              </div>
            </div>
            <div class="text-center">
              <h3
                class="mb-1 line-clamp-2 text-sm font-medium transition-colors group-hover:text-blue-400"
              >
                {{ game.name }}
              </h3>
              <div class="text-muted text-xs">
                <div v-if="game.playtimeMinutes">
                  {{ formatPlaytime(game.playtimeMinutes) }}
                </div>
                <div v-if="game.lastPlayedAt" class="text-dimmed text-xs">
                  {{ formatLastPlayed(game.lastPlayedAt) }}
                </div>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>

    <div v-else class="text-muted py-12 text-center">
      <Icon name="heroicons:clock" class="mx-auto mb-4 h-12 w-12 opacity-50" />
      <p>No recent games found</p>
      <p class="text-sm">Play some games to see them here!</p>
    </div>
  </div>
</template>
