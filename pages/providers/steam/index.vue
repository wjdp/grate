<script setup lang="ts">
const { $client } = useNuxtApp();

const { data: status, refresh: refreshStatus } = await useAsyncData(
  "steam-status",
  () => $client.steamStatus.query(),
);

const apiKey = ref("");
const steamId = ref("");

const isSteamIdValid = computed(() => /^\d{17}$/.test(steamId.value));
const isFormValid = computed(() => !!apiKey.value && isSteamIdValid.value);

const errorMessage = ref("");

const saveSteamCredentials = async () => {
  if (!isFormValid.value) {
    return;
  }
  errorMessage.value = "";
  const { error } = await tryCatch(
    $client.steamAuth.mutate({
      apiKey: apiKey.value,
      steamId: steamId.value,
    }),
  );
  if (error) {
    errorMessage.value = error.message;
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
      Your SteamID64, 17 digits:
      <input type="text" v-model="steamId" class="border-1 bg-slate-600" />
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
