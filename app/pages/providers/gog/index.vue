<script setup lang="ts">
import { getGogLoginUri } from "#shared/providers/gog";
import { getPageTitle } from "#shared/title";

useSeoMeta({ title: getPageTitle("GOG") });

const breadcrumbs = [
  { label: "Providers", to: "/providers" },
  { label: "GOG" },
];

const { data: status, refresh: refreshStatus } =
  await useFetch("/api/providers/gog");

const authUri = getGogLoginUri();
const openAuthPage = () => {
  window.open(authUri, "_blank")?.focus();
};

const gogRedirectUrl = ref("");

const parseRedirectUrl = (url: string) => {
  const urlParams = new URLSearchParams(url);
  return urlParams.get("code");
};

const oAuthCode = computed(() => parseRedirectUrl(gogRedirectUrl.value));
const isOAuthCodeValid = computed(
  () => !!oAuthCode.value && oAuthCode.value.length === 192,
);

const errorMessage = ref("");
const isConnecting = ref(false);
const toast = useToast();

const connectGog = async () => {
  if (!oAuthCode.value) {
    return;
  }
  errorMessage.value = "";
  isConnecting.value = true;
  try {
    await $fetch("/api/providers/gog/auth", {
      method: "POST",
      body: { code: oAuthCode.value },
    });
  } catch (error) {
    errorMessage.value = fetchErrorMessage(error as Error);
    console.error(error);
    return;
  } finally {
    isConnecting.value = false;
  }
  gogRedirectUrl.value = "";
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
      <ProviderIcon provider="gog" class="size-7" />
      GOG
    </h1>

    <UCard>
      <UBadge
        v-if="status"
        color="success"
        variant="soft"
        icon="i-lucide-check"
        class="self-start"
      >
        Connected as {{ status.username }}
      </UBadge>
      <UBadge v-else color="neutral" variant="soft" class="self-start">
        Not connected
      </UBadge>
    </UCard>

    <div class="flex flex-col gap-4">
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-external-link"
        class="self-start"
        @click="openAuthPage"
      >
        Log in with GOG
      </UButton>

      <UFormField
        label="Redirect URL"
        name="gogRedirectUrl"
        description="After logging in you land on a blank page. Paste its whole URL here — it carries the authorisation code."
      >
        <UInput v-model="gogRedirectUrl" class="w-full" />
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
        :disabled="!isOAuthCodeValid"
        :loading="isConnecting"
        @click="connectGog"
      >
        Connect GOG account
      </UButton>
    </div>
  </div>
</template>
