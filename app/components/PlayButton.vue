<script setup lang="ts">
const props = defineProps<{ href: string }>();

const launchGame = () => {
  window.open(props.href, "_self");
};
</script>

<template>
  <UButton
    color="primary"
    icon="i-lucide-play"
    label="Play"
    @click="launchGame"
  />
</template>
