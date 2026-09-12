<script setup lang="ts">
import QRCode from "qrcode";

const AUTHORISED_DEVICES_URL =
  "https://store.steampowered.com/account/authorizeddevices";
const POLL_INTERVAL_MS = 2000;
const PLACEHOLDER_QR_TEXT = "https://s.team/q/1/placeholder";

const { purpose } = defineProps<{ purpose: "identify" | "link" }>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{
  connected: [{ id: string; steamId: string; personaName: string }];
}>();

const title = computed(() =>
  purpose === "link" ? "Link Steam web session" : "Scan to identify your account",
);

type Phase = "starting" | "pending" | "expired" | "error";

const phase = ref<Phase>("starting");
const message = ref("");
const qrSvg = ref("");
const placeholderSvg = ref("");
const attemptId = ref<string | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

const stopPolling = () => {
  if (pollTimer === null) return;
  clearInterval(pollTimer);
  pollTimer = null;
};

// Steam rotates the challenge every ~20s; only a changed URL is re-rendered so
// the code swaps in place rather than blinking on every poll.
const renderedChallengeUrl = ref("");

const renderQr = async (url: string) => {
  if (url === renderedChallengeUrl.value) return;
  qrSvg.value = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
  });
  renderedChallengeUrl.value = url;
};

const cancelAttempt = async () => {
  const id = attemptId.value;
  attemptId.value = null;
  if (!id || phase.value !== "pending") return;
  await $fetch(`/api/providers/steam/qr/${id}`, { method: "DELETE" }).catch(
    () => {},
  );
};

const poll = async () => {
  const id = attemptId.value;
  if (!id) return;
  const login = await $fetch(`/api/providers/steam/qr/${id}`).catch(() => null);
  if (!login || attemptId.value !== id) return;
  if (login.qrChallengeUrl && login.state === "pending") {
    await renderQr(login.qrChallengeUrl);
    return;
  }
  if (login.state === "pending") return;
  stopPolling();
  attemptId.value = null;
  if (login.state === "authenticated") {
    open.value = false;
    emit("connected", {
      id,
      steamId: login.steamId ?? "",
      personaName: login.personaName ?? "",
    });
    return;
  }
  phase.value = login.state;
  message.value = login.message ?? "";
};

const renderPlaceholder = async () => {
  if (placeholderSvg.value) return;
  placeholderSvg.value = await QRCode.toString(PLACEHOLDER_QR_TEXT, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
  });
};

const startAttempt = async () => {
  stopPolling();
  phase.value = "starting";
  message.value = "";
  qrSvg.value = "";
  renderedChallengeUrl.value = "";
  await renderPlaceholder();
  try {
    const { id, qrChallengeUrl } = await $fetch("/api/providers/steam/qr", {
      method: "POST",
    });
    attemptId.value = id;
    await renderQr(qrChallengeUrl);
    phase.value = "pending";
    pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  } catch (error) {
    phase.value = "error";
    message.value = fetchErrorMessage(error as Error);
  }
};

watch(
  open,
  (isOpen) => {
    if (import.meta.server) return;
    if (isOpen) {
      startAttempt();
      return;
    }
    stopPolling();
    cancelAttempt();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopPolling();
  cancelAttempt();
});
</script>

<template>
  <UModal v-model:open="open">
    <template #title>
      <span class="flex items-center gap-2">
        <ProviderIcon provider="steam" class="size-5" />
        {{ title }}
      </span>
    </template>
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-muted text-sm text-center">
          Open the Steam mobile app
          <UIcon name="i-lucide-arrow-right" class="relative top-0.75" />
          Steam Guard
          <UIcon name="i-lucide-arrow-right" class="relative top-0.75" />
          Scan QR code
        </p>

        <div
          v-if="phase === 'starting' || phase === 'pending'"
          class="flex flex-col items-center gap-3"
        >
          <div
            class="size-64 rounded-lg bg-white p-2 [&>svg]:size-full"
            data-testid="steam-qr"
          >
            <div
              class="transition-[filter,opacity] duration-100 ease-out [&>svg]:size-full"
              :class="{ 'blur-sm opacity-40': !qrSvg }"
              v-html="qrSvg || placeholderSvg"
            />
          </div>
          <p class="text-muted flex items-center gap-2 text-sm">
            <UIcon name="i-lucide-loader-circle" class="animate-spin" />
            Waiting for scan…
          </p>
        </div>

        <div v-else class="flex flex-col items-center gap-3">
          <UAlert
            v-if="phase === 'expired'"
            color="warning"
            variant="soft"
            icon="i-lucide-clock"
            title="QR code expired"
            description="The code is only valid for five minutes."
          />
          <UAlert
            v-else
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            title="Could not connect"
            :description="message"
          />
          <UButton color="primary" @click="startAttempt">Try again</UButton>
        </div>

        <UAlert
          v-if="phase === 'starting' || phase === 'pending'"
          color="warning"
          variant="soft"
          icon="i-lucide-shield-alert"
          title="A browser-style login, opted into knowingly"
          :ui="{ description: 'text-default' }"
        >
          <template #description>
            <p>
              grate uses this session at most once a day for data the Web API
              key cannot reach — owned DLC today, more later. The Web API key
              is Steam's sanctioned route; the Subscriber Agreement forbids
              automated use of the store itself, which is what this session
              does. grate's earlier mobile-style login got an account
              restricted, so link it only if you accept that risk. The session
              grants full account access, including purchases. grate cannot
              renew it: it expires after about seven months. Revoke it at any
              time under Steam's
              <ULink
                :to="AUTHORISED_DEVICES_URL"
                target="_blank"
                class="underline"
                >Authorised Devices</ULink
              >.
            </p>
          </template>
        </UAlert>
      </div>
    </template>
  </UModal>
</template>
