<script setup lang="ts">
import type { GameWithProviders } from "#shared/types/Game";

const props = defineProps<{ game: GameWithProviders }>();

type Provider = "steam" | "gog" | "epic";

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
    class="hover:bg-elevated flex items-center gap-3 px-3 py-2 transition-colors"
  >
    <GameIcon :game="game" class="size-8 shrink-0 rounded-md" />
    <span class="text-highlighted min-w-0 flex-1 truncate text-sm font-medium">
      {{ game.name }}
    </span>
    <span class="text-dimmed hidden items-center gap-1 sm:flex">
      <ProviderIcon
        v-for="provider in providers"
        :key="provider"
        :provider="provider"
        class="size-3.5"
      />
    </span>
    <span class="text-muted w-20 shrink-0 text-right text-xs tabular-nums">
      {{
        game.playtimeMinutes ? formatPlaytime(game.playtimeMinutes) : "Unplayed"
      }}
    </span>
    <span
      class="text-dimmed hidden w-32 shrink-0 text-right text-xs md:inline-block"
    >
      {{ game.lastPlayedAt ? formatLastPlayed(game.lastPlayedAt) : "—" }}
    </span>
    <span class="hidden w-28 shrink-0 justify-end sm:flex">
      <GameStateBadge :state="game.state" />
    </span>
  </NuxtLink>
</template>
