<script setup lang="ts">
import type { TaskName } from "#shared/tasks";

const { $client } = useNuxtApp();

const triggerTask = async (taskName: TaskName) =>
  await $client.runTask.mutate({ taskName });
</script>

<template>
  <main>
    <Button @click="triggerTask('sleep')">Sleep</Button>
    <Button @click="triggerTask('fail')">Fail</Button>
  </main>
</template>
