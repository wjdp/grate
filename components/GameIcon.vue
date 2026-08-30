<script lang="ts" setup>
import type { GameWithProviders } from "~/shared/types/Game";
import {
  getGogIconUrl,
  getPrimaryGogGame,
  getPrimarySteamGame,
} from "~/shared/art";
import { computed } from "vue";

const props = defineProps<{
  game: GameWithProviders;
}>();

const imgIconUrl = computed(() => {
  const steamGame = getPrimarySteamGame(props.game);
  if (steamGame) {
    return `/art/steam/${steamGame.appId}/icon`;
  }
  const gogGame = getPrimaryGogGame(props.game);
  if (gogGame) {
    return getGogIconUrl(gogGame);
  }
  return null;
});
</script>

<template>
  <img v-if="imgIconUrl" :src="imgIconUrl" :alt="`${game.name} Icon`" />
</template>
