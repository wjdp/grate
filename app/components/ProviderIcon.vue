<script setup lang="ts">
import { ProviderLabels, type Provider } from "#shared/providers";

defineProps<{ provider: Provider }>();

const Icons: Record<Provider, string> = {
  steam: "i-simple-icons-steam",
  gog: "i-simple-icons-gogdotcom",
  epic: "i-simple-icons-epicgames",
};
</script>

<template>
  <UIcon
    :name="Icons[provider]"
    role="img"
    :aria-label="ProviderLabels[provider]"
  />
</template>
