<script setup lang="ts"></script>

<template>
  <div>
    <h1>Task State</h1>
    <TaskState state="pending" />
    <TaskState state="in_progress" />
    <TaskState state="done" />
    <TaskState state="failed" />
  </div>
  <div>
    <h1>HistoryGrid</h1>
    <HistoryGrid class="max-w-[64rem]" :year="2025" />
  </div>
</template>
