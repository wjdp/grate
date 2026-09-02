<script setup lang="ts">
import QRCode from "qrcode";

const AUTHORISED_DEVICES_URL =
  "https://store.steampowered.com/account/authorizeddevices";
const POLL_INTERVAL_MS = 2000;

const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ connected: [] }>();

type Phase = "starting" | "pending" | "expired" | "error";

const phase = ref<Phase>("starting");
const message = ref("");
const qrSvg = ref("");
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
    emit("connected");
    return;
  }
  phase.value = login.state;
  message.value = login.message ?? "";
};

const startAttempt = async () => {
  stopPolling();
  phase.value = "starting";
  message.value = "";
  qrSvg.value = "";
  renderedChallengeUrl.value = "";
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
  <UModal v-model:open="open" title="Connect Steam account">
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-muted text-sm">
          Open the Steam mobile app → Steam Guard → Scan QR code
        </p>

        <div
          v-if="phase === 'starting' || phase === 'pending'"
          class="flex flex-col items-center gap-3"
        >
          <div
            class="size-64 rounded-lg bg-white p-2 [&>svg]:size-full"
            data-testid="steam-qr"
            v-html="qrSvg"
          />
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
          color="warning"
          variant="subtle"
          icon="i-lucide-shield-alert"
          title="This grants grate full access to your Steam account"
        >
          <template #description>
            Scanning gives grate the same session the Steam mobile app holds,
            including the ability to make purchases. Revoke it any time by
            removing the device named “grate” on Steam's
            <ULink
              :to="AUTHORISED_DEVICES_URL"
              target="_blank"
              class="underline"
            >
              Authorised Devices
            </ULink>
            page.
          </template>
        </UAlert>
      </div>
    </template>
  </UModal>
</template>
