<script lang="ts" setup>
import { formatFuzzyDateRange } from "#shared/fuzzyDate";
import type {
  PlaytimeCorrectionJson,
  PlaytimeSessionJson,
} from "#shared/types/PlaytimeSession";

const props = defineProps<{
  sessions: PlaytimeSessionJson[];
  gameId?: number;
  corrections?: PlaytimeCorrectionJson[];
}>();

const emit = defineEmits<{ changed: [] }>();

const now = new Date();

interface SessionGroup {
  key: string;
  heading: string;
  sessions: PlaytimeSessionJson[];
}

// `calendarMonth` is a plain year-month, so it is read as local midnight rather
// than through `new Date("YYYY-MM")`, which parses as UTC.
const formatCalendarMonth = (calendarMonth: string) => {
  const [year, month] = calendarMonth.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
};

const groupOf = (session: PlaytimeSessionJson) => {
  if (session.playDay)
    return {
      key: `day-${session.playDay}`,
      heading: formatSessionDay(session.playDay, now),
    };
  if (session.calendarMonth)
    return {
      key: `month-${session.calendarMonth}`,
      heading: formatCalendarMonth(session.calendarMonth),
    };
  if (session.calendarYear)
    return {
      key: `year-${session.calendarYear}`,
      heading: String(session.calendarYear),
    };
  return { key: "undated", heading: "Undated range" };
};

const groups = computed<SessionGroup[]>(() => {
  const grouped = new Map<string, SessionGroup>();
  for (const session of props.sessions) {
    const { key, heading } = groupOf(session);
    const group = grouped.get(key) ?? { key, heading, sessions: [] };
    group.sessions.push(session);
    grouped.set(key, group);
  }
  return [...grouped.values()];
});

const correctionsById = computed(
  () => new Map((props.corrections ?? []).map((entry) => [entry.id, entry])),
);

const isManual = (session: PlaytimeSessionJson) =>
  session.correction
    ? correctionsById.value.get(session.correction.id)?.snapshotId === null
    : false;

// A correction is shown as the user typed it, tilde and all, even when its
// precision anchors it to a play day.
const sessionWindow = (session: PlaytimeSessionJson) =>
  session.correction
    ? formatFuzzyDateRange(
        session.correction.playedFrom,
        session.correction.playedTo,
      )
    : formatSessionWindow(session, now);

const sessionKey = (session: PlaytimeSessionJson) =>
  session.correction
    ? `correction-${session.correction.id}`
    : `${session.provider}-${session.providerId}-${session.endedBefore}-${session.minutes}`;

const dialogOpen = ref(false);
const dialogSession = ref<PlaytimeSessionJson | null>(null);
const dialogEdit = ref(false);

const dialogTarget = computed(() => {
  const session = dialogSession.value;
  if (!session || dialogEdit.value || session.snapshotId === null) return null;
  return { snapshotId: session.snapshotId, maxMinutes: session.minutes };
});

const dialogExisting = computed(() => {
  const correction = dialogSession.value?.correction;
  if (!dialogEdit.value || !correction) return null;
  const stored = correctionsById.value.get(correction.id);
  return {
    id: correction.id,
    minutes: stored?.minutes ?? dialogSession.value?.minutes ?? 0,
    playedFrom: correction.playedFrom,
    playedTo: correction.playedTo,
    note: correction.note,
  };
});

const openDialog = (session: PlaytimeSessionJson, edit: boolean) => {
  dialogSession.value = session;
  dialogEdit.value = edit;
  dialogOpen.value = true;
};
</script>

<template>
  <div v-if="groups.length" class="space-y-4">
    <section v-for="group in groups" :key="group.key" class="space-y-1.5">
      <h3 class="text-muted text-xs font-semibold tracking-wide uppercase">
        {{ group.heading }}
      </h3>
      <ul class="space-y-1">
        <li
          v-for="session in group.sessions"
          :key="sessionKey(session)"
          class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
          :class="isLowConfidence(session) ? 'text-muted' : ''"
        >
          <ProviderIcon :provider="session.provider" />
          <span class="font-medium tabular-nums">
            {{ formatSessionDuration(session) }}
          </span>
          <span class="text-muted">{{ sessionWindow(session) }}</span>
          <UTooltip
            v-if="isLowConfidence(session) && !session.correction"
            :text="formatObservationWindow(session, now)"
          >
            <span
              role="img"
              class="text-dimmed cursor-help"
              aria-label="Low confidence session"
            >
              ≈
            </span>
          </UTooltip>
          <UTooltip
            v-if="session.correction"
            :text="session.correction.note ?? undefined"
            :disabled="!session.correction.note"
          >
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
              :label="isManual(session) ? 'manual' : 'corrected'"
            />
          </UTooltip>
          <template v-if="gameId">
            <UButton
              v-if="session.correction"
              variant="ghost"
              color="neutral"
              size="xs"
              label="Edit"
              @click="openDialog(session, true)"
            />
            <UButton
              v-else-if="session.snapshotId !== null"
              variant="ghost"
              color="neutral"
              size="xs"
              label="Correct…"
              @click="openDialog(session, false)"
            />
          </template>
        </li>
      </ul>
    </section>

    <PlaytimeCorrectionDialog
      v-if="gameId && dialogSession"
      v-model:open="dialogOpen"
      :game-id="gameId"
      :provider="dialogSession.provider"
      :provider-id="dialogSession.providerId"
      :provider-name="dialogSession.providerName"
      :target="dialogTarget"
      :existing="dialogExisting"
      @saved="emit('changed')"
    />
  </div>
  <p v-else class="text-muted">
    No sessions yet — sessions appear after the first playtime change is
    observed.
  </p>
</template>
