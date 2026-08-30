<script setup lang="ts">
export type Provider = "steam" | "gog" | "epic";

defineProps<{ provider: Provider }>();

const Icons: Record<Provider, string> = {
  steam: "i-simple-icons-steam",
  gog: "i-simple-icons-gogdotcom",
  epic: "i-simple-icons-epicgames",
};

const Labels: Record<Provider, string> = {
  steam: "Steam",
  gog: "GOG",
  epic: "Epic Games",
};
</script>

<template>
  <UIcon :name="Icons[provider]" role="img" :aria-label="Labels[provider]" />
</template>
