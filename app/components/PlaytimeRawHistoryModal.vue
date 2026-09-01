<script lang="ts" setup>
import { ProviderLabels } from "#shared/providers";

const props = defineProps<{ gameId: number }>();

const open = ref(false);

const { data, status, execute } = useFetch(
  () => `/api/games/${props.gameId}/playtimes`,
  { immediate: false },
);

const playtimes = computed(() => data.value?.playtimes ?? []);

const onOpen = () => {
  open.value = true;
  if (status.value === "idle") execute();
};

const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-GB");

const columns = [
  { accessorKey: "timestampStart", header: "Start" },
  { accessorKey: "timestampEnd", header: "End" },
  { accessorKey: "provider", header: "Provider" },
  { accessorKey: "providerName", header: "Name" },
  {
    accessorKey: "playtimeMinutes",
    header: "Playtime",
    meta: {
      class: { th: "text-right", td: "text-right font-mono tabular-nums" },
    },
  },
];

// Records are cumulative snapshots, newest first: a row whose total matches the
// next-older one records no new play.
const meta = {
  class: {
    tr: (row: { index: number }) =>
      playtimes.value[row.index + 1]?.playtimeMinutes ===
      playtimes.value[row.index]?.playtimeMinutes
        ? "text-dimmed"
        : "",
  },
};
</script>

<template>
  <div>
    <UButton
      variant="ghost"
      color="neutral"
      size="xs"
      icon="i-lucide-database"
      label="Raw sync data"
      @click="onOpen"
    />
    <UModal v-model:open="open" title="Raw sync data" :ui="{ content: 'max-w-3xl' }">
      <template #body>
        <div class="space-y-3">
          <p class="text-muted text-sm">
            Cumulative totals recorded at each sync. For diagnosing sync
            behaviour.
          </p>
          <div v-if="status === 'pending'" class="text-muted text-sm">
            Loading…
          </div>
          <div v-else-if="playtimes.length" class="overflow-x-auto">
            <UTable :data="playtimes" :columns="columns" :meta="meta">
              <template #timestampStart-cell="{ row }">
                <span class="font-mono text-xs">
                  {{
                    row.original.timestampStart
                      ? formatTimestamp(row.original.timestampStart)
                      : "—"
                  }}
                </span>
              </template>
              <template #timestampEnd-cell="{ row }">
                <span class="font-mono text-xs">
                  {{ formatTimestamp(row.original.timestampEnd) }}
                </span>
              </template>
              <template #provider-cell="{ row }">
                <span class="flex items-center gap-1.5">
                  <ProviderIcon :provider="row.original.provider" />
                  {{ ProviderLabels[row.original.provider] }}
                </span>
              </template>
              <template #playtimeMinutes-cell="{ row }">
                {{ formatPlaytime(row.original.playtimeMinutes) || "None" }}
              </template>
            </UTable>
          </div>
          <p v-else class="text-muted">No playtime recorded yet</p>
        </div>
      </template>
    </UModal>
  </div>
</template>
