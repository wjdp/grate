<script lang="ts" setup>
import { isValidFuzzyDate } from "#shared/fuzzyDate";
import type { PlaytimeProvider } from "#shared/types/PlaytimeSession";

interface CorrectionTarget {
  snapshotId: number;
  maxMinutes: number;
}

interface ExistingCorrection {
  id: number;
  minutes: number;
  playedFrom: string;
  playedTo: string;
  note: string | null;
}

const props = withDefaults(
  defineProps<{
    gameId: number;
    provider: PlaytimeProvider;
    providerId: number;
    providerName: string;
    target: CorrectionTarget | null;
    existing?: ExistingCorrection | null;
    // Only changes the title: undated pre-history is dated, not corrected.
    mode?: "correct" | "date";
  }>(),
  { existing: null, mode: "correct" },
);

const emit = defineEmits<{ saved: [] }>();
const open = defineModel<boolean>("open", { default: false });

const playedFrom = ref("");
const playedTo = ref("");
const minutes = ref<number | null>(null);
const note = ref("");
const error = ref<string | null>(null);
const pending = ref(false);
const confirmingDelete = ref(false);

const reset = () => {
  playedFrom.value = props.existing?.playedFrom ?? "";
  playedTo.value = props.existing?.playedTo ?? "";
  minutes.value = props.existing?.minutes ?? props.target?.maxMinutes ?? null;
  note.value = props.existing?.note ?? "";
  error.value = null;
  pending.value = false;
  confirmingDelete.value = false;
};

const {
  data: settings,
  status: settingsStatus,
  execute: loadSettings,
} = useFetch("/api/settings", { immediate: false });

watch(
  () => [open.value, props.existing?.id, props.target?.snapshotId],
  () => {
    if (!open.value) return;
    reset();
    if (settingsStatus.value === "idle") loadSettings();
  },
  { immediate: true },
);

const timezoneHint = computed(() =>
  settings.value
    ? ` Times are read in ${settings.value.effectiveTimezone}.`
    : "",
);

const title = computed(() => {
  if (props.existing) return "Edit correction";
  if (!props.target) return "Add session";
  return props.mode === "date" ? "Date this playtime" : "Correct session";
});

// A blank To means the play finished within the From date.
const playedToText = computed(
  () => playedTo.value.trim() || playedFrom.value.trim(),
);

const fromValid = computed(() => isValidFuzzyDate(playedFrom.value.trim()));
const toValid = computed(() => isValidFuzzyDate(playedToText.value));
const minutesValid = computed(() => {
  const value = minutes.value;
  if (value === null || !Number.isInteger(value) || value < 1) return false;
  return props.target ? value <= props.target.maxMinutes : true;
});

const fromError = computed(() =>
  playedFrom.value.trim() && !fromValid.value ? "Not a valid date" : undefined,
);
const toError = computed(() =>
  playedTo.value.trim() && !toValid.value ? "Not a valid date" : undefined,
);
const minutesError = computed(() => {
  if (minutes.value === null || minutes.value === undefined) return undefined;
  if (!minutesValid.value && props.target && minutes.value > props.target.maxMinutes)
    return `More than the ${formatPlaytime(props.target.maxMinutes) || "0m"} observed`;
  return minutesValid.value ? undefined : "Must be at least 1 minute";
});

const canSubmit = computed(
  () => fromValid.value && toValid.value && minutesValid.value,
);

const minutesHint = computed(() =>
  props.target
    ? `of ${formatPlaytime(props.target.maxMinutes) || "0m"} observed`
    : undefined,
);

const submit = async () => {
  if (!canSubmit.value || pending.value) return;
  pending.value = true;
  error.value = null;
  const body = {
    minutes: minutes.value,
    playedFrom: playedFrom.value.trim(),
    playedTo: playedToText.value,
    note: note.value.trim() || null,
  };
  try {
    if (props.existing) {
      await $fetch(
        `/api/games/${props.gameId}/corrections/${props.existing.id}`,
        { method: "PATCH", body },
      );
    } else {
      await $fetch(`/api/games/${props.gameId}/corrections`, {
        method: "POST",
        body: {
          provider: props.provider,
          providerId: props.providerId,
          snapshotId: props.target?.snapshotId ?? null,
          ...body,
        },
      });
    }
    open.value = false;
    emit("saved");
  } catch (submitError) {
    error.value = fetchErrorMessage(submitError as Error);
  } finally {
    pending.value = false;
  }
};

const remove = async () => {
  if (!props.existing) return;
  if (!confirmingDelete.value) {
    confirmingDelete.value = true;
    return;
  }
  pending.value = true;
  error.value = null;
  try {
    await $fetch(
      `/api/games/${props.gameId}/corrections/${props.existing.id}`,
      { method: "DELETE" },
    );
    open.value = false;
    emit("saved");
  } catch (deleteError) {
    error.value = fetchErrorMessage(deleteError as Error);
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <UModal v-model:open="open" :title="title" :ui="{ body: 'space-y-4' }">
    <template #body>
      <p class="text-muted text-sm">
        <ProviderIcon :provider="provider" class="mr-1 inline-block" />
        {{ providerName }}
      </p>

      <p v-if="!target" class="text-muted text-sm">
        Counts towards playtime and last played; the store did not report it.
      </p>

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :description="error"
      />

      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="From" :error="fromError">
          <UInput
            v-model="playedFrom"
            placeholder="2020-10-12"
            data-testid="correction-from"
            class="w-full"
          />
        </UFormField>
        <UFormField label="To" :error="toError">
          <UInput
            v-model="playedTo"
            placeholder="Same as From"
            data-testid="correction-to"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="text-dimmed text-xs">
        Year, month, day or minute: 2020, 2020-10, 2020-10-12,
        2020-10-12T20:00. Add ~ for approximately.{{ timezoneHint }}
      </p>

      <UFormField label="Minutes" :hint="minutesHint" :error="minutesError">
        <UInput
          v-model.number="minutes"
          type="number"
          min="1"
          :max="target?.maxMinutes"
          data-testid="correction-minutes"
        />
      </UFormField>

      <UFormField label="Note" hint="Optional">
        <UInput v-model="note" class="w-full" data-testid="correction-note" />
      </UFormField>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="primary"
          :label="existing ? 'Save' : 'Add'"
          :disabled="!canSubmit"
          :loading="pending"
          data-testid="correction-submit"
          @click="submit"
        />
        <UButton
          variant="ghost"
          color="neutral"
          label="Cancel"
          :disabled="pending"
          @click="open = false"
        />
        <UButton
          v-if="existing"
          class="ml-auto"
          variant="ghost"
          color="error"
          :label="confirmingDelete ? 'Confirm delete' : 'Delete'"
          :disabled="pending"
          data-testid="correction-delete"
          @click="remove"
        />
      </div>
    </template>
  </UModal>
</template>
