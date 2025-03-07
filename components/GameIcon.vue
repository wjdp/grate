<script lang="ts" setup>
import type { GameWithSteam } from "~/shared/types/Game";
import { computed } from "vue";

const props = defineProps<{
  game: GameWithSteam;
}>();

const imgIconUrl = computed(() =>
  props.game.steamGame
    ? `http://media.steampowered.com/steamcommunity/public/images/apps/${props.game.steamGame.appId}/${props.game.steamGame.imgIconUrl}.jpg`
    : null,
);
</script>

<template>
  <img v-if="imgIconUrl" :src="imgIconUrl" :alt="`${game.name} Icon`" />
</template>
