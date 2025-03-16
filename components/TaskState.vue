<script setup lang="ts">
import type { SseTask } from "~/lib/hooks";

const props = defineProps<{
  state: SseTask["state"];
}>();

const NameMap: Record<SseTask["state"], string> = {
  pending: "Pending",
  in_progress: "Running",
  done: "Done",
  failed: "Failed",
};
</script>

<template>
  <span
    class="rounded px-2 py-1 font-semibold"
    :class="{
      'bg-grey-600': state === 'pending',
      'bg-blue-600': state === 'in_progress',
      'bg-green-600': state === 'done',
      'bg-red-600': state === 'failed',
    }"
    >{{ NameMap[state] }}</span
  >
</template>
