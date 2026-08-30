<script lang="ts" setup>
import type { GameWithProviders } from "~/shared/types/Game";
import { getGogIconUrl } from "~/shared/art";
import { computed } from "vue";

const props = defineProps<{
  game: GameWithProviders;
}>();

const imgIconUrl = computed(() => {
  if (props.game.steamGame) {
    return `/art/steam/${props.game.steamGame.appId}/icon`;
  }
  if (props.game.gogGame) {
    return getGogIconUrl(props.game.gogGame);
  }
  return null;
});
</script>

<template>
  <img v-if="imgIconUrl" :src="imgIconUrl" :alt="`${game.name} Icon`" />
</template>
