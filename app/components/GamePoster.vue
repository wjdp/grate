<script setup lang="ts">
import type { GameWithProviders } from "#shared/types/Game";
import type { Provider } from "#shared/providers";
import { getGameArtUrls } from "#shared/art";

const props = defineProps<{ game: GameWithProviders }>();

const posterUrl = computed(() => getGameArtUrls(props.game)?.poster ?? null);

const posterFailed = ref(false);
watch(posterUrl, () => {
  posterFailed.value = false;
});

const providers = computed<Provider[]>(() => {
  const found: Provider[] = [];
  if (props.game.steamGames.length) found.push("steam");
  if (props.game.gogGames.length) found.push("gog");
  if (props.game.epicGames.length) found.push("epic");
  return found;
});
</script>

<template>
  <NuxtLink
    :to="`/game/${game.id}`"
    :prefetch="false"
    class="group block transition-transform motion-safe:hover:-translate-y-0.5"
  >
    <div
      class="bg-elevated border-default aspect-[3/4] overflow-hidden rounded-lg border transition-shadow group-hover:shadow-lg"
    >
      <img
        v-if="posterUrl && !posterFailed"
        :src="posterUrl"
        :alt="game.name"
        width="600"
        height="800"
        loading="lazy"
        class="size-full object-cover"
        @error="posterFailed = true"
      />
      <PosterPlaceholder v-else :name="game.name" />
    </div>
    <div class="mt-2 space-y-1">
      <h3 class="text-highlighted line-clamp-2 text-sm font-medium">
        {{ game.name }}
      </h3>
      <p class="text-muted text-xs tabular-nums">
        {{
          game.playtimeMinutes
            ? formatPlaytime(game.playtimeMinutes)
            : "Unplayed"
        }}
      </p>
      <GameStateBadge v-if="game.state" :state="game.state" size="sm" />
      <div v-if="providers.length" class="text-dimmed flex items-center gap-1">
        <ProviderIcon
          v-for="provider in providers"
          :key="provider"
          :provider="provider"
          class="size-3"
        />
      </div>
    </div>
  </NuxtLink>
</template>
