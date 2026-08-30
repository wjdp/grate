<script setup lang="ts">
import { getPageTitle } from "#shared/title";

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
  },
  {
    provider: "gog" as const,
    name: "GOG",
    connectedAs: gog.value?.username ?? null,
  },
  {
    provider: "epic" as const,
    name: "Epic Games",
    connectedAs: epic.value?.displayName ?? null,
  },
]);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1
        class="font-display text-highlighted text-2xl font-semibold tracking-tight"
      >
        Providers
      </h1>
      <p class="text-muted mt-1 text-sm">Where your games come from</p>
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
            v-if="entry.connectedAs"
            color="success"
            variant="soft"
            icon="i-lucide-check"
            class="self-start"
          >
            Connected as {{ entry.connectedAs }}
          </UBadge>
          <UBadge v-else color="neutral" variant="soft" class="self-start">
            Not connected
          </UBadge>

          <UButton
            :to="`/providers/${entry.provider}`"
            color="neutral"
            variant="subtle"
            block
          >
            {{ entry.connectedAs ? "Manage" : "Connect" }}
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
