<script setup lang="ts">
const props = defineProps<{ steamAppId: number | string }>();

const launchGame = () => {
  window.open(`steam://run/${props.steamAppId}`, "_self");
};
</script>

<template>
  <Button
    @click="launchGame"
    class="bg-emerald-500 bg-gradient-to-br from-emerald-400 to-emerald-600 hover:bg-emerald-600"
    icon="ic:sharp-play-arrow"
  >
    Play
  </Button>
</template>
