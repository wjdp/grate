<script setup lang="ts">
import type { TaskName } from "#shared/tasks";
import { TASK_NAMES } from "#shared/tasks";

const { $client } = useNuxtApp();

const triggerTask = async (taskName: TaskName) =>
  await $client.runTask.mutate({ taskName });

const { onMessage, open } = useSseClient();
const messages = ref<string[]>([]);
const messageLog = useTemplateRef("messageLog");
onMessage("message", async (event) => {
  messages.value.push(`Message: ${event.message}`);
  await nextTick();
  if (messageLog.value) {
    messageLog.value.scrollTop = messageLog.value.scrollHeight;
  }
});
</script>

<template>
  <main>
    <div>
      <Button
        v-for="taskName in TASK_NAMES"
        :key="taskName"
        @click="triggerTask(taskName)"
        class="m-4"
        >{{ taskName }}
      </Button>
    </div>
    <div>
      <ul
        class="m-4 h-[60vh] overflow-y-auto bg-gray-600 p-4 font-mono font-semibold"
        ref="messageLog"
      >
        <li v-for="message in messages" :key="message">{{ message }}</li>
      </ul>
    </div>
  </main>
</template>
