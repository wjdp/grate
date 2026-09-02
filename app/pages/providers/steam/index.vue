<script setup lang="ts">
import { getPageTitle } from "#shared/title";

const AUTHORISED_DEVICES_URL =
  "https://store.steampowered.com/account/authorizeddevices";
const EXPIRY_WARNING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

useSeoMeta({ title: getPageTitle("Steam") });

const breadcrumbs = [
  { label: "Providers", to: "/providers" },
  { label: "Steam" },
];

const { data: status, refresh: refreshStatus } =
  await useFetch("/api/providers/steam");

const isLoginModalOpen = ref(false);
const isDisconnecting = ref(false);
const toast = useToast();

const sessionExpiresAt = computed(() =>
  status.value?.sessionExpiresAt ? new Date(status.value.sessionExpiresAt) : null,
);
const isConnected = computed(() => sessionExpiresAt.value !== null);
const hasExpired = computed(
  () => sessionExpiresAt.value !== null && sessionExpiresAt.value <= new Date(),
);
const isExpiringSoon = computed(
  () =>
    sessionExpiresAt.value !== null &&
    !hasExpired.value &&
    sessionExpiresAt.value.getTime() - Date.now() <
      EXPIRY_WARNING_DAYS * DAY_MS,
);

const formatDateTime = (date: Date) =>
  date.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const expiryLabel = computed(() =>
  sessionExpiresAt.value ? formatDateTime(sessionExpiresAt.value) : "",
);

const formatRelative = (value: string) => {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
};

const onConnected = async () => {
  await refreshStatus();
  toast.add({ title: "Connected", color: "success" });
};

const disconnect = async () => {
  isDisconnecting.value = true;
  try {
    await $fetch("/api/providers/steam/unlink", { method: "POST" });
    await refreshStatus();
    toast.add({ title: "Disconnected", color: "success" });
  } catch (error) {
    toast.add({
      title: "Could not disconnect",
      description: fetchErrorMessage(error as Error),
      color: "error",
    });
  } finally {
    isDisconnecting.value = false;
  }
};
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
      <div class="flex flex-col gap-3 text-sm">
        <UBadge
          v-if="status && isConnected"
          color="success"
          variant="soft"
          icon="i-lucide-check"
          class="self-start"
        >
          Connected as {{ status.personaName }}
        </UBadge>
        <UBadge
          v-else-if="status"
          color="warning"
          variant="soft"
          icon="i-lucide-unplug"
          class="self-start"
        >
          {{ status.personaName }} — session removed
        </UBadge>
        <UBadge v-else color="neutral" variant="soft" class="self-start">
          Not connected
        </UBadge>

        <p v-if="status" class="text-muted">
          SteamID <span class="font-mono">{{ status.steamId }}</span>
        </p>

        <template v-if="status && sessionExpiresAt && !hasExpired">
          <p class="text-muted">
            Session valid until
            {{ expiryLabel }}, renews automatically.
          </p>
          <p v-if="status.lastRenewedAt" class="text-muted">
            Last renewed: {{ formatRelative(status.lastRenewedAt) }}
          </p>
          <p v-else-if="status.lastRenewAttemptAt" class="text-muted">
            Last renewal check:
            {{ formatRelative(status.lastRenewAttemptAt) }}
          </p>
        </template>

        <div class="flex flex-wrap items-center gap-2">
          <ProviderSyncButton v-if="isConnected" provider="steam" />
          <UButton
            v-if="!isConnected || hasExpired"
            color="primary"
            icon="i-lucide-qr-code"
            @click="isLoginModalOpen = true"
          >
            Connect Steam account
          </UButton>
          <UButton
            v-if="status"
            color="neutral"
            variant="outline"
            :loading="isDisconnecting"
            @click="disconnect"
          >
            Disconnect
          </UButton>
        </div>
      </div>
    </UCard>

    <UAlert
      v-if="hasExpired"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="Steam session expired — re-scan to reconnect"
      description="Steam syncs will keep failing until a new QR code is scanned."
    />
    <UAlert
      v-else-if="isExpiringSoon"
      color="warning"
      variant="soft"
      icon="i-lucide-clock"
      title="Re-scan to keep Steam syncing"
    >
      <template #description>
        <div class="flex flex-col items-start gap-3">
          <p>
            The session expires on
            {{ expiryLabel }} and renewal has not extended it yet.
          </p>
          <UButton
            color="warning"
            variant="solid"
            icon="i-lucide-qr-code"
            @click="isLoginModalOpen = true"
          >
            Connect Steam account
          </UButton>
        </div>
      </template>
    </UAlert>

    <p v-if="status" class="text-muted text-sm">
      Disconnecting removes the session from grate. To revoke it on Steam's
      side, remove the device named “grate” on the
      <ULink :to="AUTHORISED_DEVICES_URL" target="_blank" class="underline">
        Authorised Devices
      </ULink>
      page.
    </p>

    <SteamQrLoginModal v-model:open="isLoginModalOpen" @connected="onConnected" />
  </PageContainer>
</template>
