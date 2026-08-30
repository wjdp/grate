<script lang="ts" setup>
import type { GameWithProviders } from "#shared/types/Game";
import {
  getEpicIconUrl,
  getGogIconUrl,
  getPrimaryEpicGame,
  getPrimaryGogGame,
  getPrimarySteamGame,
} from "#shared/art";
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
  const epicGame = getPrimaryEpicGame(props.game);
  if (epicGame) {
    return getEpicIconUrl(epicGame);
  }
  return null;
});
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
