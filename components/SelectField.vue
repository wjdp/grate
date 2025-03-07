<script lang="ts" setup>
const value = defineModel();
</script>

<template>
  <select
    class="rounded border border-gray-300 bg-slate-900 p-1 text-white"
    v-model="value"
  >
    <slot />
  </select>
</template>
