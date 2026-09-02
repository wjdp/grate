<script setup lang="ts">
import { getPageTitle } from "#shared/title";

useSeoMeta({ title: getPageTitle("Steam") });

const breadcrumbs = [
  { label: "Providers", to: "/providers" },
  { label: "Steam" },
];

const { data: status } = await useFetch("/api/providers/steam");
</script>

<template>
  <PageContainer class="flex max-w-2xl flex-col gap-6">
    <UBreadcrumb :items="breadcrumbs" />

    <h1
      class="font-display text-highlighted flex items-center gap-3 text-2xl font-semibold tracking-tight"
    >
      <ProviderIcon provider="steam" class="size-7" />
      Steam
    </h1>

    <UCard>
      <div v-if="status" class="flex flex-col gap-2 text-sm">
        <UBadge
          color="success"
          variant="soft"
          icon="i-lucide-check"
          class="self-start"
        >
          Connected as {{ status.personaName }}
        </UBadge>
        <p class="text-muted">
          SteamID <span class="font-mono">{{ status.steamId }}</span
          >, session valid until {{ status.sessionExpiresAt }}.
        </p>
        <ProviderSyncButton provider="steam" class="self-start" />
      </div>
      <UBadge v-else color="neutral" variant="soft" class="self-start">
        Not connected
      </UBadge>
    </UCard>
  </PageContainer>
</template>
