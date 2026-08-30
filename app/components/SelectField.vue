<script lang="ts" setup>
const value = defineModel();
</script>

<template>
  <select
    class="border-grey-300 rounded border bg-slate-900 p-1 text-white"
    v-model="value"
  >
    <slot />
  </select>
</template>
