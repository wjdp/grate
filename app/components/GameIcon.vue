<script lang="ts" setup>
import { computed } from "vue";
import { getGameArtUrls } from "#shared/art";
import type { GameWithProviders } from "#shared/types/Game";

const props = defineProps<{
  game: GameWithProviders;
}>();

const imgIconUrl = computed(() => getGameArtUrls(props.game)?.icon ?? null);
</script>

<template>
  <img v-if="imgIconUrl" :src="imgIconUrl" :alt="`${game.name} icon`" />
  <UAvatar
    v-else
    icon="i-lucide-gamepad-2"
    :alt="game.name"
    class="size-full rounded-md"
  />
</template>
