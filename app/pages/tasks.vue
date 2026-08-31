<script setup lang="ts">
import type { TaskName } from "#shared/tasks";
import { TASK_NAMES } from "#shared/tasks";
import type { SseTask } from "~~/lib/hooks";
import { getPageTitle } from "#shared/title";

useSeoMeta({ title: getPageTitle("Tasks") });

const WORD_OVERRIDES: Record<string, string> = {
  gog: "GOG",
  steam: "Steam",
  epic: "Epic",
};

const humaniseTaskName = (taskName: string) => {
  const words = taskName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[\s-_]+/)
    .map((word) => WORD_OVERRIDES[word] ?? word);
  return (
    words[0][0].toUpperCase() +
    words[0].slice(1) +
    " " +
    words.slice(1).join(" ")
  );
};

const toast = useToast();
const runningTask = ref<TaskName | null>(null);

const triggerTask = async (taskName: TaskName) => {
  runningTask.value = taskName;
  try {
    await $fetch("/api/tasks", { method: "POST", body: { taskName } });
    toast.add({
      title: `${humaniseTaskName(taskName)} queued`,
      icon: "i-lucide-play",
      color: "primary",
    });
  } catch (error) {
    toast.add({
      title: `Could not queue ${humaniseTaskName(taskName)}`,
      description: error instanceof Error ? error.message : undefined,
      icon: "i-lucide-triangle-alert",
      color: "error",
    });
  } finally {
    runningTask.value = null;
  }
};

const { onMessage } = useSseClient();
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

interface ProgressSample {
  at: number;
  progress: number;
}

interface ProgressTrack {
  first: ProgressSample;
  latest: ProgressSample;
  count: number;
}

const progressTracks = reactive(new Map<number, ProgressTrack>());

const trackProgress = (task: SseTask) => {
  if (task.state !== "in_progress" || task.progress === undefined) {
    progressTracks.delete(task.id);
    return;
  }
  const sample: ProgressSample = { at: Date.now(), progress: task.progress };
  const track = progressTracks.get(task.id);
  if (!track || task.progress < track.latest.progress) {
    progressTracks.set(task.id, { first: sample, latest: sample, count: 1 });
    return;
  }
  track.latest = sample;
  track.count++;
};

const MIN_PROGRESS_FOR_ESTIMATE = 0.02;

const formatDuration = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) return `${totalMinutes}m ${seconds}s`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const timeRemaining = (task: SseTask) => {
  const track = progressTracks.get(task.id);
  if (!track || track.count < 2) return null;
  const progressDelta = track.latest.progress - track.first.progress;
  const elapsed = track.latest.at - track.first.at;
  if (progressDelta < MIN_PROGRESS_FOR_ESTIMATE || elapsed <= 0) return null;
  const remaining = ((1 - track.latest.progress) * elapsed) / progressDelta;
  if (remaining <= 0) return null;
  return `~${formatDuration(remaining)} left`;
};

const progressDetail = (task: SseTask) => {
  if (task.state !== "in_progress") return null;
  const parts: string[] = [];
  if (task.done !== undefined && task.total !== undefined) {
    parts.push(`${task.done}/${task.total}`);
  }
  const remaining = timeRemaining(task);
  if (remaining) parts.push(remaining);
  return parts.length > 0 ? parts.join(" · ") : null;
};

// Fetch existing tasks, without this we'll only see new tasks via server events
const { data: currentTasks } = await useFetch("/api/tasks");
if (currentTasks.value) {
  taskLogs.value = currentTasks.value;
}

onMessage("task", (event) => {
  trackProgress(event);
  const existingTask = taskLogs.value.find((task) => task.id === event.id);
  if (existingTask) {
    Object.assign(existingTask, event);
    return;
  }
  taskLogs.value.push(event);
});

const newestFirst = computed(() => taskLogs.value.toReversed());

const isLongMessage = (message: string) =>
  message.length > 160 || message.includes("\n");
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-1">
      <h1
        class="font-display text-highlighted text-2xl font-semibold tracking-tight"
      >
        Tasks
      </h1>
      <p class="text-muted text-sm">
        Background sync jobs. Scheduled hourly; run one now if you need to.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="taskName in TASK_NAMES"
        :key="taskName"
        variant="outline"
        color="neutral"
        icon="i-lucide-play"
        :loading="runningTask === taskName"
        @click="triggerTask(taskName)"
      >
        {{ humaniseTaskName(taskName) }}
      </UButton>
    </div>

    <div
      v-if="newestFirst.length === 0"
      class="border-default flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center"
    >
      <UIcon name="i-lucide-list-checks" class="text-dimmed size-10" />
      <p class="font-display text-highlighted text-lg font-semibold">
        No tasks yet
      </p>
      <p class="text-muted text-sm">Run one above to see it here.</p>
    </div>

    <div
      v-else
      class="divide-default border-default divide-y overflow-hidden rounded-lg border"
    >
      <div
        v-for="task in newestFirst"
        :key="task.id"
        class="bg-elevated/50 space-y-2 p-3"
      >
        <div class="flex flex-wrap items-center gap-3">
          <TaskState :state="task.state" />
          <span class="text-highlighted font-medium">
            {{ humaniseTaskName(task.name) }}
          </span>
          <span class="text-dimmed font-mono text-xs">#{{ task.id }}</span>
          <UProgress
            v-if="task.state === 'in_progress' && task.progress !== undefined"
            :model-value="task.progress"
            :max="1"
            class="w-40"
          />
          <span
            v-if="progressDetail(task)"
            class="text-muted text-xs tabular-nums"
          >
            {{ progressDetail(task) }}
          </span>
        </div>

        <UCollapsible v-if="task.message && isLongMessage(task.message)">
          <UButton
            variant="link"
            color="neutral"
            size="xs"
            icon="i-lucide-chevron-down"
            label="Message"
            class="p-0"
          />
          <template #content>
            <pre
              class="text-muted mt-1 font-mono text-xs whitespace-pre-wrap"
              >{{ task.message }}</pre
            >
          </template>
        </UCollapsible>
        <pre
          v-else-if="task.message"
          class="text-muted font-mono text-xs whitespace-pre-wrap"
          >{{ task.message }}</pre
        >
      </div>
    </div>

    <UCollapsible>
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-terminal"
        label="Event log"
      />
      <template #content>
        <ul
          ref="messageLog"
          class="bg-muted border-default text-muted mt-2 h-48 overflow-y-auto rounded-lg border p-3 font-mono text-xs"
        >
          <li v-for="(message, index) in messages" :key="index">
            {{ message }}
          </li>
          <li v-if="messages.length === 0" class="text-dimmed">
            Waiting for events
          </li>
        </ul>
      </template>
    </UCollapsible>
  </div>
</template>
