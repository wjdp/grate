<script setup lang="ts">
const props = defineProps<{ href: string }>();

const launchGame = () => {
  window.open(props.href, "_self");
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
