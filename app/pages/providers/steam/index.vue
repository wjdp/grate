<script setup lang="ts">
import { parseSteamProfileInput } from "#shared/steam-profile";

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

const saveSteamCredentials = async () => {
  if (!isFormValid.value) {
    return;
  }
  errorMessage.value = "";
  try {
    await $fetch("/api/providers/steam/auth", {
      method: "POST",
      body: { apiKey: apiKey.value, profile: profile.value },
    });
  } catch (error) {
    errorMessage.value = fetchErrorMessage(error as Error);
    console.error(error);
    return;
  }
  apiKey.value = "";
  await refreshStatus();
};
</script>

<template>
  <div class="p-4">
    <h1>Steam Status</h1>
    <div class="my-4">
      <template v-if="status">
        Connected as {{ status.personaName }} ({{ status.steamId }}),
        {{ status.hasApiKey ? "API key stored" : "no API key stored" }}.
      </template>
      <template v-else> No Steam account connected. </template>
    </div>
    <div class="my-4">
      Get an API key from
      <a
        href="https://steamcommunity.com/dev/apikey"
        target="_blank"
        class="underline"
        >steamcommunity.com/dev/apikey</a
      >:
      <input type="password" v-model="apiKey" class="border-1 bg-slate-600" />
    </div>
    <div class="my-4">
      Steam profile URL or SteamID64:
      <input
        type="text"
        v-model="profile"
        placeholder="https://steamcommunity.com/id/yourname"
        class="border-1 bg-slate-600"
      />
    </div>
    <div v-if="errorMessage" class="my-4 text-red-400">{{ errorMessage }}</div>
    <div class="my-4">
      <Button
        @click="saveSteamCredentials"
        color="primary"
        :disabled="!isFormValid"
        >Save Steam Credentials
      </Button>
    </div>
  </div>
</template>

<style scoped></style>
