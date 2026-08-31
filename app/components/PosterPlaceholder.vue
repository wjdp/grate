<script setup lang="ts">
import { getPlaceholderColourCss } from "#shared/artPlaceholder";

const props = defineProps<{ name: string }>();

const backgroundColour = computed(() => getPlaceholderColourCss(props.name));
</script>

<template>
  <div
    class="relative size-full"
    :style="{ backgroundColor: backgroundColour }"
  >
    <div
      class="absolute inset-0 bg-gradient-to-b from-transparent to-black/40"
    />
    <div class="absolute inset-0 flex items-center p-4">
      <p
        class="font-display line-clamp-4 text-lg leading-tight font-semibold text-balance text-white/90"
      >
        {{ name }}
      </p>
    </div>
  </div>
</template>
