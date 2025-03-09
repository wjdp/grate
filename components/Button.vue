<script lang="ts" setup>
defineEmits(["click"]);
</script>

<template>
  <button
    @click="$emit('click')"
    class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:underline"
  >
    <slot></slot>
  </button>
</template>
