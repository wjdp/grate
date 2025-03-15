<script setup lang="ts">
import type { TaskName } from "#shared/tasks";
import { TASK_NAMES } from "#shared/tasks";
import type { SseTask } from "~/lib/hooks";

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

const taskLogs = ref<SseTask[]>([]);

// Fetch existing tasks, without this we'll only see new tasks via server events
const currentTasks = await $client.listTasks.useQuery();
if (currentTasks.data.value) {
  taskLogs.value = currentTasks.data.value;
}

onMessage("task", (event) => {
  // Check if we already have a task with the same id
  const existingTask = taskLogs.value.find((task) => task.id === event.id);
  if (existingTask) {
    // If we do, update the existing task
    Object.assign(existingTask, event);
    return;
  }
  taskLogs.value.push(event);
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
    <div>{{ currentTasks }}</div>
    <div class="m-4 h-[20vh] overflow-y-auto bg-gray-800">
      <ol v-for="task in taskLogs.toReversed()" :key="task.id" class="m-4">
        <li>
          <div>
            <TaskState :state="task.state" class="mr-2" />
            <span class="mr-2 font-mono">{{ task.id }}</span>
            <span class="mr-2 font-semibold">{{ task.name }}</span>
            <progress
              v-if="task.progress !== undefined && task.state === 'in_progress'"
              :value="task.progress"
              max="1"
            ></progress>
          </div>
          <div v-if="task.message" class="my-2">
            <pre class="text-xs">{{ task.message }}</pre>
          </div>
        </li>
      </ol>
    </div>

    <div>
      <ul
        class="m-4 h-[20vh] overflow-y-auto bg-gray-600 p-4 font-mono font-semibold"
        ref="messageLog"
      >
        <li v-for="message in messages" :key="message">{{ message }}</li>
      </ul>
    </div>
  </main>
</template>
