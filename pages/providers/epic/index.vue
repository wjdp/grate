<script setup lang="ts">
import { getEpicLoginUri } from "~/lib/epic/api";

const { $client } = useNuxtApp();

const { data: epicStatus, refresh: refreshStatus } = await useAsyncData(
  "epic-status",
  async () => ({ user: await $client.epicStatus.query() }),
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

const connectEpic = async () => {
  if (!isCodeValid.value) {
    return;
  }
  errorMessage.value = "";
  const { error } = await tryCatch(
    $client.epicAuth.mutate({ code: authorizationCode.value }),
  );
  if (error) {
    errorMessage.value = error.message;
    console.error(error);
    return;
  }
  redirectInput.value = "";
  await refreshStatus();
};
</script>

<template>
  <div class="p-4">
    <h1>Epic Status</h1>
    <div class="my-4">
      <template v-if="epicStatus?.user">
        Connected as {{ epicStatus.user.displayName }} ({{
          epicStatus.user.accountId
        }}).
      </template>
      <template v-else> No Epic account connected. </template>
    </div>
    <div class="my-4">
      <Button @click="openAuthPage" color="primary">Login with Epic</Button>
    </div>
    <div class="my-4">
      After logging in you'll land on a page showing JSON. Paste the whole JSON,
      or just the <code>authorizationCode</code> value, below. Reloading that
      redirect page gives a <code>null</code> code — if that happens, use the
      login button again to get a fresh one.
      <input
        type="text"
        v-model="redirectInput"
        class="border-1 bg-slate-600"
      />
    </div>
    <div v-if="errorMessage" class="my-4 text-red-400">{{ errorMessage }}</div>
    <div class="my-4">
      <Button @click="connectEpic" color="primary" :disabled="!isCodeValid"
        >Connect Epic Account
      </Button>
    </div>
  </div>
</template>

<style scoped></style>
