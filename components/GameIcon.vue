<script lang="ts" setup>
import type { GameWithSteam } from "~/shared/types/Game";
import { computed } from "vue";

const props = defineProps<{
  game: GameWithSteam;
}>();

const imgIconUrl = computed(() =>
  props.game.steamGame ? `/art/steam/${props.game.steamGame.appId}/icon` : null,
);
</script>

<template>
  <img v-if="imgIconUrl" :src="imgIconUrl" :alt="`${game.name} Icon`" />
</template>
