<script setup lang="ts">
import { getPageTitle } from "#shared/title";

useSeoMeta({ title: getPageTitle("Settings") });

const { data: settings } = await useFetch("/api/settings");

const serverTimezone = computed(() => settings.value?.serverTimezone ?? "UTC");

const timezoneItems = computed(() => [
  { label: `Use server timezone (${serverTimezone.value})`, value: null },
  ...Intl.supportedValuesOf("timeZone").map((zone) => ({
    label: zone,
    value: zone,
  })),
]);

const hourItems = Array.from({ length: 24 }, (_, hour) => ({
  label: `${String(hour).padStart(2, "0")}:00`,
  value: hour,
}));

const timezone = ref<string | null>(null);
const dayBoundaryHour = ref(6);

watchEffect(() => {
  if (!settings.value) return;
  timezone.value = settings.value.timezone;
  dayBoundaryHour.value = settings.value.dayBoundaryHour;
});

const hasChanges = computed(() => {
  if (!settings.value) return false;
  return (
    timezone.value !== settings.value.timezone ||
    dayBoundaryHour.value !== settings.value.dayBoundaryHour
  );
});

const isSaving = ref(false);
const toast = useToast();

const saveSettings = async () => {
  if (!hasChanges.value) return;
  isSaving.value = true;
  try {
    const updated = await $fetch("/api/settings", {
      method: "PATCH",
      body: {
        timezone: timezone.value,
        dayBoundaryHour: dayBoundaryHour.value,
      },
    });
    settings.value = updated;
    toast.add({ title: "Settings saved", color: "success" });
  } catch (error) {
    toast.add({
      title: "Failed to save settings",
      description: fetchErrorMessage(error as Error),
      color: "error",
    });
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <h1
      class="font-display text-highlighted text-2xl font-semibold tracking-tight"
    >
      Settings
    </h1>

    <div class="flex flex-col gap-4">
      <h2 class="font-display text-highlighted text-lg font-semibold">
        Time
      </h2>

      <UFormField label="Timezone" name="timezone">
        <template #description>
          Used to decide which day a session belongs to. Falls back to the
          server's TZ environment variable, currently
          {{ serverTimezone }}.
        </template>
        <USelectMenu
          v-model="timezone"
          :items="timezoneItems"
          value-key="value"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Day starts at"
        name="dayBoundaryHour"
        description="Play before this hour counts towards the previous day, so a 1am session belongs to the evening before."
      >
        <USelectMenu
          v-model="dayBoundaryHour"
          :items="hourItems"
          value-key="value"
          :search-input="false"
          class="w-40"
        />
      </UFormField>

      <UButton
        color="primary"
        class="self-start"
        :disabled="!hasChanges"
        :loading="isSaving"
        @click="saveSettings"
      >
        Save
      </UButton>
    </div>
  </div>
</template>
