<script setup lang="ts">
import { reactive } from "vue";
import { logEvent } from "histoire/client";

const state = reactive({
  year: 2025,
});
</script>

<template>
  <Story title="HistoryGrid">
    <HistoryGrid :year="state.year" />

    <template #controls>
      <HstNumber title="Year" v-model="state.year" />
    </template>
  </Story>
</template>
