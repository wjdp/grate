<script lang="ts" setup>
defineProps<{
  icon?: string;
}>();
defineEmits(["click"]);
</script>

<template>
  <button
    @click="$emit('click')"
    class="group max-h-10 rounded bg-blue-500 px-4 py-2 font-bold text-white hover:cursor-pointer disabled:pointer-events-none disabled:opacity-50"
  >
    <Icon
      v-if="icon"
      :name="icon"
      class="mr-1 inline-block"
      size="1.5em"
      style="vertical-align: -0.25em"
      mode="css"
    />
    <span class="group-hover:"><slot></slot></span>
  </button>
</template>
