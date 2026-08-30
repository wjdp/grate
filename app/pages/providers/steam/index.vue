<script setup lang="ts">
import { parseSteamProfileInput } from "#shared/steam-profile";
import { getPageTitle } from "#shared/title";

useSeoMeta({ title: getPageTitle("Steam") });

const breadcrumbs = [
  { label: "Providers", to: "/providers" },
  { label: "Steam" },
];

const { data: status, refresh: refreshStatus } = await useFetch(
  "/api/providers/steam",
);

const apiKey = ref("");
const profile = ref("");

const isProfileValid = computed(
  () => parseSteamProfileInput(profile.value) !== null,
);
const isFormValid = computed(() => !!apiKey.value && isProfileValid.value);

const errorMessage = ref("");
const isSaving = ref(false);
const toast = useToast();

const saveSteamCredentials = async () => {
  if (!isFormValid.value) {
    return;
  }
  errorMessage.value = "";
  isSaving.value = true;
  try {
    await $fetch("/api/providers/steam/auth", {
      method: "POST",
      body: { apiKey: apiKey.value, profile: profile.value },
    });
  } catch (error) {
    errorMessage.value = fetchErrorMessage(error as Error);
    console.error(error);
    return;
  } finally {
    isSaving.value = false;
  }
  apiKey.value = "";
  await refreshStatus();
  toast.add({ title: "Connected", color: "success" });
};
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
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
          >, {{ status.hasApiKey ? "API key stored" : "no API key stored" }}.
        </p>
      </div>
      <UBadge v-else color="neutral" variant="soft" class="self-start">
        Not connected
      </UBadge>
    </UCard>

    <div class="flex flex-col gap-4">
      <UFormField label="API key" name="apiKey">
        <template #description>
          Get an API key from
          <ULink
            to="https://steamcommunity.com/dev/apikey"
            target="_blank"
            class="underline"
          >
            steamcommunity.com/dev/apikey </ULink
          >.
        </template>
        <UInput v-model="apiKey" type="password" class="w-full" />
      </UFormField>

      <UFormField
        label="Steam profile"
        name="profile"
        description="Profile URL or SteamID64."
      >
        <UInput
          v-model="profile"
          placeholder="https://steamcommunity.com/id/yourname"
          class="w-full"
        />
      </UFormField>

      <UAlert
        v-if="errorMessage"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :description="errorMessage"
      />

      <UButton
        color="primary"
        class="self-start"
        :disabled="!isFormValid"
        :loading="isSaving"
        @click="saveSteamCredentials"
      >
        Save credentials
      </UButton>
    </div>
  </div>
</template>
