<script setup lang="ts">
import type { DailyPlaytime } from "~~/lib/activity";
import { formatPlaytime } from "~/utils/formatPlaytime";

const { year, days } = defineProps<{
  year: number;
  days: DailyPlaytime[];
}>();

const isLeapYear = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const daysInYear = computed(() => (isLeapYear(year) ? 366 : 365));

const startOfYear = computed(() => new Date(year, 0, 1).getDay());

const minutesByDate = computed(
  () => new Map(days.map((day) => [day.date, day.minutes])),
);

const grid = computed(() => {
  const weeks = [];
  let dayCounter = 0;
  for (let i = 0; i < 53; i++) {
    const week = [];
    for (let j = 0; j < 7; j++) {
      if (i === 0 && j < startOfYear.value) {
        week.push(null);
      } else if (dayCounter < daysInYear.value) {
        week.push(dayCounter);
        dayCounter++;
      }
    }
    if (week.length > 0) weeks.push(week);
  }
  return weeks;
});

const monthPositions = computed(() => {
  const months = [];
  const monthDays = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let dayOfYear = 0;
  for (let i = 0; i < 12; i++) {
    months.push({
      name: new Date(year, i, 1).toLocaleString("default", { month: "short" }),
      position: (dayOfYear / daysInYear.value) * 100,
    });
    dayOfYear += monthDays[i];
  }
  return months;
});

const pad = (value: number) => String(value).padStart(2, "0");

const localIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const weekAndDayNumberToDate = (week: number, day: number) => {
  const dayOfYear = week * 7 + day - startOfYear.value;
  return localIsoDate(new Date(year, 0, dayOfYear + 1));
};

const SCALE = [
  "bg-muted",
  "bg-amber-200 dark:bg-amber-900",
  "bg-amber-400 dark:bg-amber-700",
  "bg-amber-600 dark:bg-amber-500",
  "bg-amber-800 dark:bg-amber-400",
];

const BUCKET_EDGES = [60, 180, 360];

const bucketClass = (minutes: number) => {
  if (minutes <= 0) return SCALE[0];
  const bucket = BUCKET_EDGES.filter((edge) => minutes >= edge).length;
  return SCALE[bucket + 1];
};

const minutesFor = (date: string) => minutesByDate.value.get(date) ?? 0;

const cellTitle = (date: string) => {
  const minutes = minutesFor(date);
  return minutes > 0
    ? `${date}: ${formatPlaytime(minutes)}`
    : `${date}: nothing`;
};
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="no-scrollbar flex flex-col overflow-x-auto">
      <div v-if="grid" class="min-w-[64rem] pt-1 pb-2">
        <div class="relative mb-1 h-4 w-full">
          <span
            v-for="(month, index) in monthPositions"
            :key="index"
            class="text-dimmed absolute text-xs"
            :style="{ left: `${month.position}%` }"
          >
            {{ month.name }}
          </span>
        </div>
        <div class="flex w-full gap-1">
          <div
            v-for="(week, wIndex) in grid"
            :key="wIndex"
            class="flex grow flex-col gap-1"
          >
            <div
              v-for="(day, dIndex) in week"
              :key="dIndex"
              class="h-4 rounded"
              :class="
                day != null
                  ? bucketClass(
                      minutesFor(weekAndDayNumberToDate(wIndex, dIndex)),
                    )
                  : 'opacity-0'
              "
              :title="
                day != null
                  ? cellTitle(weekAndDayNumberToDate(wIndex, dIndex))
                  : undefined
              "
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div class="text-dimmed flex items-center gap-1.5 text-xs">
      <span>Less</span>
      <span
        v-for="(swatch, index) in SCALE"
        :key="index"
        class="size-3 rounded"
        :class="swatch"
      />
      <span>More</span>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
