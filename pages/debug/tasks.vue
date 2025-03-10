<script setup lang="ts">
const { $client } = useNuxtApp();

const triggerTasks = async () => {
  await $client.runTask.mutate({ taskName: "abc" });
};
</script>

<template>
  <main>
    <Button @click="triggerTasks()">Trigger Tasks</Button>
  </main>
</template>
