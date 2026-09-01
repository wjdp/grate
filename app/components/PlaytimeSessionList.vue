<script lang="ts" setup>
import type { PlaytimeSessionJson } from "#shared/types/PlaytimeSession";

const props = defineProps<{ sessions: PlaytimeSessionJson[] }>();

const now = new Date();

interface SessionDay {
  key: string;
  heading: string;
  sessions: PlaytimeSessionJson[];
}

const days = computed<SessionDay[]>(() => {
  const grouped = new Map<string, SessionDay>();
  for (const session of props.sessions) {
    const key = session.playDay;
    const day = grouped.get(key) ?? {
      key,
      heading: formatSessionDay(key, now),
      sessions: [],
    };
    day.sessions.push(session);
    grouped.set(key, day);
  }
  return [...grouped.values()];
});

const sessionKey = (session: PlaytimeSessionJson) =>
  `${session.provider}-${session.providerId}-${session.endedBefore}-${session.minutes}`;
</script>

<template>
  <div v-if="days.length" class="space-y-4">
    <section v-for="day in days" :key="day.key" class="space-y-1.5">
      <h3 class="text-muted text-xs font-semibold tracking-wide uppercase">
        {{ day.heading }}
      </h3>
      <ul class="space-y-1">
        <li
          v-for="session in day.sessions"
          :key="sessionKey(session)"
          class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
          :class="isLowConfidence(session) ? 'text-muted' : ''"
        >
          <ProviderIcon :provider="session.provider" />
          <span class="font-medium tabular-nums">
            {{ formatSessionDuration(session) }}
          </span>
          <span class="text-muted">{{ formatSessionWindow(session, now) }}</span>
          <UTooltip
            v-if="isLowConfidence(session)"
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
        </li>
      </ul>
    </section>
  </div>
  <p v-else class="text-muted">
    No sessions yet — sessions appear after the first playtime change is
    observed.
  </p>
</template>
