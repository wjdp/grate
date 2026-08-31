<script setup lang="ts">
defineProps<{
  background: string | null;
  logo: string | null;
  title: string;
}>();
</script>

<template>
  <div class="bg-elevated relative isolate overflow-hidden rounded-lg">
    <img
      v-if="background"
      :src="background"
      alt=""
      aria-hidden="true"
      class="absolute inset-0 size-full scale-110 object-cover blur-xl brightness-50"
    />
    <div
      class="absolute inset-0 bg-gradient-to-t from-(--ui-bg) via-(--ui-bg)/40 to-transparent"
      aria-hidden="true"
    />
    <div class="relative flex min-h-48 items-end gap-4 p-6">
      <img
        v-if="logo"
        :src="logo"
        :alt="title"
        class="max-h-32 w-auto max-w-full"
      />
      <h1
        v-else
        class="font-display text-highlighted text-3xl font-semibold tracking-tight"
      >
        {{ title }}
      </h1>
      <slot />
    </div>
  </div>
</template>
