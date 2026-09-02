<script setup lang="ts">
import { steamSessionState } from "#shared/providers/steamSession";
import { getPageTitle } from "#shared/title";

type ProviderState =
  | "connected"
  | "expiring"
  | "expired"
  | "removed"
  | "disconnected";

const BADGE_BY_STATE: Record<
  ProviderState,
  { color: "success" | "warning" | "error" | "neutral"; icon?: string }
> = {
  connected: { color: "success", icon: "i-lucide-check" },
  expiring: { color: "warning", icon: "i-lucide-clock" },
  expired: { color: "error", icon: "i-lucide-triangle-alert" },
  removed: { color: "warning", icon: "i-lucide-unplug" },
  disconnected: { color: "neutral" },
};

useSeoMeta({ title: getPageTitle("Providers") });

const [{ data: steam }, { data: gog }, { data: epic }] = await Promise.all([
  useFetch("/api/providers/steam"),
  useFetch("/api/providers/gog"),
  useFetch("/api/providers/epic"),
]);

const providers = computed(() => [
  {
    provider: "steam" as const,
    name: "Steam",
    connectedAs: steam.value?.personaName ?? null,
    state: steam.value
      ? steamSessionState(steam.value.sessionExpiresAt)
      : ("disconnected" as const),
  },
  {
    provider: "gog" as const,
    name: "GOG",
    connectedAs: gog.value?.username ?? null,
    state: gog.value ? ("connected" as const) : ("disconnected" as const),
  },
  {
    provider: "epic" as const,
    name: "Epic Games",
    connectedAs: epic.value?.displayName ?? null,
    state: epic.value ? ("connected" as const) : ("disconnected" as const),
  },
]);

const badgeLabel = (state: ProviderState, connectedAs: string | null) => {
  switch (state) {
    case "connected":
      return `Connected as ${connectedAs}`;
    case "expiring":
      return `${connectedAs} — session expiring`;
    case "expired":
      return `${connectedAs} — session expired`;
    case "removed":
      return `${connectedAs} — session removed`;
    default:
      return "Not connected";
  }
};

const manageButtonLabel = (state: ProviderState) => {
  switch (state) {
    case "connected":
    case "expiring":
      return "Manage";
    case "expired":
    case "removed":
      return "Reconnect";
    default:
      return "Connect";
  }
};
</script>

<template>
  <PageContainer class="flex max-w-2xl flex-col gap-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1
          class="font-display text-highlighted text-2xl font-semibold tracking-tight"
        >
          Providers
        </h1>
        <p class="text-muted mt-1 text-sm">Where your games come from</p>
      </div>
      <ProviderSyncButton class="min-w-48" block />
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <UCard v-for="entry in providers" :key="entry.provider">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <ProviderIcon :provider="entry.provider" class="size-8" />
            <span class="font-display text-highlighted text-lg font-semibold">
              {{ entry.name }}
            </span>
          </div>

          <UBadge
            :color="BADGE_BY_STATE[entry.state].color"
            variant="soft"
            :icon="BADGE_BY_STATE[entry.state].icon"
            class="self-start"
          >
            {{ badgeLabel(entry.state, entry.connectedAs) }}
          </UBadge>

          <ProviderSyncButton
            v-if="entry.state === 'connected' || entry.state === 'expiring'"
            :provider="entry.provider"
            block
          />

          <UButton
            :to="`/providers/${entry.provider}`"
            color="neutral"
            variant="subtle"
            block
          >
            {{ manageButtonLabel(entry.state) }}
          </UButton>
        </div>
      </UCard>
    </div>
  </PageContainer>
</template>
