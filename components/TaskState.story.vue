<script setup lang="ts">
const states = ["pending", "in_progress", "done", "failed"] as const;
</script>

<template>
  <Story title="TaskState" :layout="{ type: 'grid', width: '200px' }">
    <Variant v-for="state in states" :key="state" :title="state">
      <TaskState :state="state" />
    </Variant>
  </Story>
</template>
