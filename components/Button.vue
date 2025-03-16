<script lang="ts" setup>
defineEmits(["click"]);
</script>

<template>
  <button
    @click="$emit('click')"
    class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:underline disabled:pointer-events-none disabled:opacity-50"
  >
    <slot></slot>
  </button>
</template>
