<script setup lang="ts">
import { getEpicLoginUri } from "#shared/providers/epic";
import { getPageTitle } from "#shared/title";

useSeoMeta({ title: getPageTitle("Epic Games") });

const breadcrumbs = [
  { label: "Providers", to: "/providers" },
  { label: "Epic Games" },
];

const { data: epicUser, refresh: refreshStatus } = await useFetch(
  "/api/providers/epic",
);

const authUri = getEpicLoginUri();
const openAuthPage = () => {
  window.open(authUri, "_blank")?.focus();
};

const redirectInput = ref("");

const parseAuthorizationCode = (input: string): string => {
  try {
    const parsed = JSON.parse(input);
    if (typeof parsed?.authorizationCode === "string") {
      return parsed.authorizationCode;
    }
  } catch {
    // not JSON, fall through to raw input
  }
  return input.trim();
};

const authorizationCode = computed(() =>
  parseAuthorizationCode(redirectInput.value),
);
const isCodeValid = computed(() =>
  /^[0-9a-f]{32}$/i.test(authorizationCode.value),
);

const errorMessage = ref("");
const isConnecting = ref(false);
const toast = useToast();

const connectEpic = async () => {
  if (!isCodeValid.value) {
    return;
  }
  errorMessage.value = "";
  isConnecting.value = true;
  try {
    await $fetch("/api/providers/epic/auth", {
      method: "POST",
      body: { code: authorizationCode.value },
    });
  } catch (error) {
    errorMessage.value = fetchErrorMessage(error as Error);
    console.error(error);
    return;
  } finally {
    isConnecting.value = false;
  }
  redirectInput.value = "";
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
      <ProviderIcon provider="epic" class="size-7" />
      Epic Games
    </h1>

    <UCard>
      <div v-if="epicUser" class="flex flex-col gap-2 text-sm">
        <UBadge
          color="success"
          variant="soft"
          icon="i-lucide-check"
          class="self-start"
        >
          Connected as {{ epicUser.displayName }}
        </UBadge>
        <p class="text-muted">
          Account <span class="font-mono">{{ epicUser.accountId }}</span
          >.
        </p>
        <ProviderSyncButton provider="epic" class="self-start" />
      </div>
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
        Log in with Epic
      </UButton>

      <UFormField label="Authorisation code" name="redirectInput">
        <template #description>
          After logging in you land on a page showing JSON. Paste the whole
          JSON, or just the <code class="font-mono">authorizationCode</code>
          value, here. Reloading that redirect page gives a
          <code class="font-mono">null</code> code — if that happens, use the
          login button again to get a fresh one.
        </template>
        <UInput v-model="redirectInput" class="w-full" />
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
        :disabled="!isCodeValid"
        :loading="isConnecting"
        @click="connectEpic"
      >
        Connect Epic account
      </UButton>
    </div>
  </div>
</template>
