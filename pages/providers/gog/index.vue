<script setup lang="ts">
import { getGogLoginUri } from "~/lib/gog/api";

const { $client } = useNuxtApp();

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

const getGogToken = async () => {
  if (!oAuthCode.value) {
    return;
  }
  const { data, error } = await tryCatch(
    $client.gogAuth.mutate({ code: oAuthCode.value }),
  );
  if (error) {
    alert(error.message);
    console.error(error);
    return;
  }
  alert("GOG Token received, user created");
  console.log(data);
};
</script>

<template>
  <div class="p-4">
    <h1>GOG Status</h1>
    <div class="my-4">
      <Button @click="openAuthPage" color="primary">Login with GOG</Button>
    </div>
    <div class="my-4">
      Paste in URL you get redirected to after logging in with GOG:
      <input
        type="text"
        v-model="gogRedirectUrl"
        class="border-1 bg-slate-600"
      />
    </div>
    <div class="my-4">
      <Button @click="getGogToken" color="primary" :disabled="!isOAuthCodeValid"
        >Get GOG Token
      </Button>
    </div>
  </div>
</template>

<style scoped></style>
