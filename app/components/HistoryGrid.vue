<script setup lang="ts">
import { formatDateIso } from "~/utils/formatDateIso";

const { year } = defineProps<{
  year: number;
}>();

const isLeapYear = (year: number) => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

const daysInYear = computed(() => (isLeapYear(year) ? 366 : 365));

const startOfYear = computed(() => new Date(year, 0, 1).getDay());

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
    if (week.length > 0) weeks.push(week); // Ensure we only add weeks with days
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
      name: new Date(year, i, 1).toLocaleString("default", {
        month: "short",
      }),
      position: (dayOfYear / daysInYear.value) * 100,
    });
    dayOfYear += monthDays[i];
  }
  return months;
});

const weekAndDayNumberToDate = (week: number, day: number) => {
  const dayOfYear = week * 7 + day - startOfYear.value;
  return new Date(year, 0, dayOfYear + 1);
};

const getColor = (value: number) => {
  const colors = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
  if (value === 0) return colors[0];
  if (value < 3) return colors[1];
  if (value < 6) return colors[2];
  if (value < 9) return colors[3];
  return colors[4];
};

// random but deterministic
const randomValue = (wIndex: number, dIndex: number) => {
  return (wIndex * 7 + dIndex) % 10;
};
</script>

<template>
  <div
    class="no-scrollbar border-opacity-10 flex flex-col overflow-x-scroll border"
  >
    <div style="min-width: 64rem" class="px-2 pt-1 pb-2" v-if="grid">
      <div class="relative mb-1 h-4 w-full">
        <span
          v-for="(month, index) in monthPositions"
          :key="index"
          class="absolute text-xs font-bold"
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
            :title="formatDateIso(weekAndDayNumberToDate(wIndex, dIndex))"
            :style="{
              backgroundColor: getColor(randomValue(wIndex, dIndex)),
              opacity: day != null ? 1 : 0,
            }"
          ></div>
        </div>
      </div>
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
