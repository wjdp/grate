<script setup lang="ts">
import type { ProviderId } from "#shared/tasks";
import type { SseTask } from "~~/lib/hooks";

const { provider, block = false } = defineProps<{
  provider?: ProviderId;
  block?: boolean;
}>();

const label = computed(() => (provider ? "Sync" : "Sync all"));

const task = ref<SseTask | null>(null);
const isQueueing = ref(false);
const toast = useToast();

// A sync-all run (no provider in its payload) covers every provider, so it
// drives the per-provider buttons too.
const coversThisButton = (candidate: Pick<SseTask, "name" | "payload">) =>
  candidate.name === "sync" &&
  (candidate.payload?.provider === undefined ||
    candidate.payload.provider === provider);

const isRunning = (state: SseTask["state"]) =>
  state === "pending" || state === "in_progress";

const isBusy = computed(() => !!task.value && isRunning(task.value.state));

const { onMessage } = useSseClient();
onMessage("task", (event) => {
  if (!coversThisButton(event)) return;
  if (task.value && event.id < task.value.id) return;
  task.value = event;
});

// Seeding is best effort: a sync queued before this component mounted should
// still show, but the live stream is the source of truth.
onMounted(async () => {
  try {
    const existingTasks = await $fetch("/api/tasks");
    const latest = existingTasks
      .filter(
        (candidate) =>
          coversThisButton(candidate) && isRunning(candidate.state),
      )
      .reduce<SseTask | null>(
        (newest, candidate) =>
          !newest || candidate.id > newest.id ? candidate : newest,
        null,
      );
    if (latest && (!task.value || latest.id > task.value.id)) {
      task.value = latest;
    }
  } catch (error) {
    console.error("Could not read existing tasks:", error);
  }
});

const startSync = async () => {
  isQueueing.value = true;
  try {
    await $fetch("/api/tasks", {
      method: "POST",
      body: { taskName: "sync", payload: provider ? { provider } : undefined },
    });
  } catch (error) {
    toast.add({
      title: "Could not start the sync",
      description: error instanceof Error ? error.message : undefined,
      icon: "i-lucide-triangle-alert",
      color: "error",
    });
  } finally {
    isQueueing.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2" :class="block && 'w-full'">
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="subtle"
        :block="block"
        :loading="isQueueing || isBusy"
        :disabled="isBusy"
        :class="block && 'flex-1'"
        @click="startSync"
      >
        {{ label }}
      </UButton>
      <TaskState v-if="task" :state="task.state" />
    </div>

    <UProgress
      v-if="task?.state === 'in_progress' && task.progress !== undefined"
      :model-value="task.progress"
      :max="1"
    />

    <p v-if="isBusy && task?.message" class="text-muted truncate text-xs">
      {{ task.message }}
    </p>
  </div>
</template>
