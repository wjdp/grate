<script setup lang="ts">
defineProps<{
  label: string;
  value?: string | number;
  icon?: string;
}>();
</script>

<template>
  <div class="bg-elevated border-default rounded-lg border p-4">
    <div class="text-muted flex items-center gap-1.5 text-xs tracking-wide">
      <UIcon v-if="icon" :name="icon" class="size-4 shrink-0" />
      <span class="truncate">{{ label }}</span>
    </div>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
    <div
      v-else
      class="font-display text-highlighted mt-1 text-2xl font-semibold tabular-nums"
    >
      {{ value }}
    </div>
  </div>
</template>
