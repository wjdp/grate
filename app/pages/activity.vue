<script lang="ts" setup>
import { getPageTitle } from "#shared/title";
import { formatPlaytime } from "~/utils/formatPlaytime";

useSeoMeta({ title: getPageTitle("Activity") });

const FIRST_YEAR = 2020;
const currentYear = new Date().getFullYear();
const years = Array.from(
  { length: currentYear - FIRST_YEAR + 1 },
  (_, index) => currentYear - index,
);

const route = useRoute();
const router = useRouter();

const year = computed<number>({
  get() {
    const raw = route.query.year;
    const value = Number(Array.isArray(raw) ? raw[0] : raw);
    return years.includes(value) ? value : currentYear;
  },
  set(value) {
    const query = { ...route.query };
    if (value === currentYear) delete query.year;
    else query.year = String(value);
    router.replace({ query });
  },
});

const { data } = await useFetch("/api/activity", {
  query: { year },
});

const days = computed(() => data.value?.days ?? []);

const totalMinutes = computed(() =>
  days.value.reduce((total, day) => total + day.minutes, 0),
);
const longestDay = computed(() =>
  days.value.reduce((longest, day) => Math.max(longest, day.minutes), 0),
);
const averageMinutes = computed(() =>
  days.value.length === 0
    ? 0
    : Math.round(totalMinutes.value / days.value.length),
);
</script>

<template>
  <PageContainer class="max-w-3xl space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1
        class="font-display text-highlighted text-2xl font-semibold tracking-tight"
      >
        Activity
      </h1>
      <USelectMenu
        v-model="year"
        :items="years"
        :search-input="false"
        icon="i-lucide-calendar"
        class="w-32"
      />
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Total this year"
        :value="formatPlaytime(totalMinutes) || '0m'"
        icon="i-lucide-clock"
      />
      <StatTile
        label="Days played"
        :value="days.length"
        icon="i-lucide-calendar-check"
      />
      <StatTile
        label="Longest day"
        :value="formatPlaytime(longestDay) || '0m'"
        icon="i-lucide-flame"
      />
      <StatTile
        label="Average per played day"
        :value="formatPlaytime(averageMinutes) || '0m'"
        icon="i-lucide-chart-no-axes-column"
      />
    </div>

    <div
      v-if="days.length === 0"
      class="border-default flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center"
    >
      <UIcon name="i-lucide-calendar-off" class="text-dimmed size-10" />
      <p class="font-display text-highlighted text-lg font-semibold">
        Nothing recorded for {{ year }}
      </p>
      <p class="text-muted text-sm">
        Playtime is recorded hourly from your connected providers.
      </p>
    </div>

    <UCard v-else>
      <HistoryGrid :year="year" :days="days" />
    </UCard>
  </PageContainer>
</template>
