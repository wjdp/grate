<script setup lang="ts">
import { steamSessionState } from "#shared/providers/steamSession";
import { parseSteamProfileInput } from "#shared/steam-profile";
import { getPageTitle } from "#shared/title";

const AUTHORISED_DEVICES_URL =
  "https://store.steampowered.com/account/authorizeddevices";
const API_KEY_URL = "https://steamcommunity.com/dev/apikey";

useSeoMeta({ title: getPageTitle("Steam") });

const breadcrumbs = [
  { label: "Providers", to: "/providers" },
  { label: "Steam" },
];

const { data: status, refresh: refreshStatus } =
  await useFetch("/api/providers/steam");

const toast = useToast();

const isConnected = computed(() => !!status.value?.hasApiKey);

interface SteamIdentity {
  steamId: string;
  personaName: string;
  avatar: string | null;
}

// A row without a key remembers who was connected, so setup can skip step one.
const identity = ref<SteamIdentity | null>(
  status.value && !status.value.hasApiKey
    ? {
        steamId: status.value.steamId,
        personaName: status.value.personaName,
        avatar: null,
      }
    : null,
);
const heldQrLoginId = ref<string | null>(null);
const setupStep = ref(identity.value ? 1 : 0);

const setupSteps = computed(() => [
  {
    slot: "identify" as const,
    title: "Identify",
    description: "Which Steam account is this?",
    icon: "i-lucide-user-search",
  },
  {
    slot: "apiKey" as const,
    title: "API key",
    description: "Lets grate read your library",
    icon: "i-lucide-key-round",
    disabled: !identity.value,
  },
]);

const isIdentifyModalOpen = ref(false);
const profileInput = ref("");
const parsedProfile = computed(() => parseSteamProfileInput(profileInput.value));
const identifyError = ref("");
const isIdentifying = ref(false);

const identifyFromProfile = async () => {
  if (!parsedProfile.value) return;
  identifyError.value = "";
  isIdentifying.value = true;
  try {
    identity.value = await $fetch<SteamIdentity>(
      "/api/providers/steam/identify",
      { method: "POST", body: { profile: profileInput.value } },
    );
    setupStep.value = 1;
  } catch (error) {
    identifyError.value = fetchErrorMessage(error as Error);
  } finally {
    isIdentifying.value = false;
  }
};

const onIdentifiedByQr = ({
  id,
  steamId,
  personaName,
}: {
  id: string;
  steamId: string;
  personaName: string;
}) => {
  heldQrLoginId.value = id;
  identity.value = { steamId, personaName, avatar: null };
  identifyError.value = "";
  setupStep.value = 1;
};

const discardHeldQrLogin = async () => {
  const id = heldQrLoginId.value;
  heldQrLoginId.value = null;
  if (!id) return;
  await $fetch(`/api/providers/steam/qr/${id}`, { method: "DELETE" }).catch(
    () => {},
  );
};

const apiKey = ref("");
const connectError = ref("");
const isConnecting = ref(false);

const changeAccount = async () => {
  identity.value = null;
  profileInput.value = "";
  identifyError.value = "";
  connectError.value = "";
  setupStep.value = 0;
  await discardHeldQrLogin();
};

const connect = async () => {
  if (!identity.value || !apiKey.value) return;
  connectError.value = "";
  isConnecting.value = true;
  try {
    await $fetch("/api/providers/steam/auth", {
      method: "POST",
      body: {
        apiKey: apiKey.value,
        steamId: identity.value.steamId,
        qrLoginId: heldQrLoginId.value ?? undefined,
      },
    });
  } catch (error) {
    connectError.value = fetchErrorMessage(error as Error);
    return;
  } finally {
    isConnecting.value = false;
  }
  apiKey.value = "";
  heldQrLoginId.value = null;
  await refreshStatus();
  toast.add({ title: "Connected", color: "success" });
};

const isDisconnecting = ref(false);

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

const webSessionState = computed(() =>
  steamSessionState(status.value?.webSessionExpiresAt ?? null),
);
const isWebSessionLive = computed(
  () =>
    webSessionState.value === "connected" ||
    webSessionState.value === "expiring",
);

const isLinkModalOpen = ref(false);
const isRemovingWebSession = ref(false);

const onWebSessionLinked = async () => {
  await refreshStatus();
  toast.add({ title: "Web session linked", color: "success" });
};

const removeWebSession = async () => {
  isRemovingWebSession.value = true;
  try {
    await $fetch("/api/providers/steam/web-session", { method: "DELETE" });
    await refreshStatus();
    toast.add({ title: "Web session removed", color: "success" });
  } catch (error) {
    toast.add({
      title: "Could not remove the web session",
      description: fetchErrorMessage(error as Error),
      color: "error",
    });
  } finally {
    isRemovingWebSession.value = false;
  }
};

const formatDateTime = (date: Date) =>
  date.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const webSessionExpiryLabel = computed(() =>
  status.value?.webSessionExpiresAt
    ? formatDateTime(new Date(status.value.webSessionExpiresAt))
    : "",
);

const formatRelative = (value: string) => {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
};
</script>

<template>
  <AppPanel title="Steam" class="flex max-w-2xl flex-col gap-6">
    <UBreadcrumb :items="breadcrumbs" />

    <h1
      class="font-display text-highlighted flex items-center gap-3 text-2xl font-semibold tracking-tight"
    >
      <ProviderIcon provider="steam" class="size-7" />
      Steam
    </h1>

    <template v-if="isConnected && status">
      <UCard>
        <div class="flex flex-col gap-3 text-sm">
          <UBadge
            color="success"
            variant="soft"
            icon="i-lucide-check"
            class="self-start"
          >
            Connected as {{ status.personaName }}
          </UBadge>

          <p class="text-muted">
            SteamID <span class="font-mono">{{ status.steamId }}</span>
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <ProviderSyncButton provider="steam" />
            <UButton
              color="neutral"
              variant="outline"
              :loading="isDisconnecting"
              @click="disconnect"
            >
              Disconnect
            </UButton>
          </div>

          <p class="text-muted">
            Your API key is stored in grate's database. Revoke it at
            <ULink :to="API_KEY_URL" target="_blank" class="underline">
              steamcommunity.com/dev/apikey </ULink
            >.
          </p>
        </div>
      </UCard>

      <UCard>
        <div class="flex flex-col gap-3 text-sm">
          <h2 class="font-display text-highlighted text-lg font-semibold">
            Web session
          </h2>
          <p class="text-muted">
            Rich data: owned DLC, and later achievements, wishlist and other
            things the Web API key cannot see.
          </p>

          <UBadge
            v-if="webSessionState === 'removed'"
            color="neutral"
            variant="soft"
            class="self-start"
          >
            Not linked
          </UBadge>
          <UBadge
            v-else-if="webSessionState === 'expired'"
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            class="self-start"
          >
            Expired
          </UBadge>
          <UBadge
            v-else
            color="success"
            variant="soft"
            icon="i-lucide-check"
            class="self-start"
          >
            Linked
          </UBadge>

          <p v-if="isWebSessionLive" class="text-muted">
            Valid until {{ webSessionExpiryLabel }}. Steam does not let grate
            extend it — re-scan after that date to keep rich data syncing.
          </p>

          <UAlert
            v-if="webSessionState === 'expiring'"
            color="warning"
            variant="soft"
            icon="i-lucide-clock"
            title="Web session expiring soon"
            :description="`Re-scan before ${webSessionExpiryLabel} to keep rich data syncing.`"
          />
          <UAlert
            v-else-if="webSessionState === 'expired'"
            color="warning"
            variant="soft"
            icon="i-lucide-clock"
            title="Web session expired — re-scan to keep rich data syncing"
            description="Library and playtime syncing carries on without it."
          />

          <p v-if="status.webSessionLastUsedAt" class="text-muted">
            Last used {{ formatRelative(status.webSessionLastUsedAt) }}
          </p>

          <UAlert
            v-if="status.webSessionLastError"
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            title="Last rich data sync failed"
            :description="status.webSessionLastError"
          />

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="!isWebSessionLive"
              color="primary"
              icon="i-lucide-qr-code"
              @click="isLinkModalOpen = true"
            >
              Link web session
            </UButton>
            <UButton
              v-if="webSessionState !== 'removed'"
              color="neutral"
              variant="outline"
              :loading="isRemovingWebSession"
              @click="removeWebSession"
            >
              Remove
            </UButton>
          </div>

          <p class="text-muted">
            Revoke it on Steam's side under
            <ULink :to="AUTHORISED_DEVICES_URL" target="_blank" class="underline">
              Authorised Devices </ULink
            >.
          </p>
        </div>
      </UCard>

      <SteamQrLoginModal
        v-model:open="isLinkModalOpen"
        purpose="link"
        @connected="onWebSessionLinked"
      />
    </template>

    <UCard v-else>
      <UStepper
        v-model="setupStep"
        :items="setupSteps"
        :ui="{ content: 'mt-6' }"
      >
        <template #identify>
          <div class="flex flex-col gap-4 text-sm">
            <div class="flex flex-col gap-2">
              <p class="text-muted">
                Scanning also links a web session for rich data such as owned
                DLC.
              </p>
              <UButton
                color="primary"
                icon="i-lucide-qr-code"
                class="self-start"
                @click="isIdentifyModalOpen = true"
              >
                Scan QR with the Steam app
              </UButton>
            </div>

            <USeparator label="or" />

            <UFormField
              label="Profile URL, vanity name or SteamID64"
              name="profile"
            >
              <UInput
                v-model="profileInput"
                placeholder="https://steamcommunity.com/id/yourname"
                class="w-full"
                @keyup.enter="identifyFromProfile"
              />
            </UFormField>

            <UAlert
              v-if="identifyError"
              color="error"
              variant="soft"
              icon="i-lucide-triangle-alert"
              :description="identifyError"
            />

            <UButton
              color="neutral"
              variant="subtle"
              class="self-start"
              :disabled="!parsedProfile"
              :loading="isIdentifying"
              @click="identifyFromProfile"
            >
              Identify
            </UButton>
          </div>
        </template>

        <template #apiKey>
          <div v-if="identity" class="flex flex-col gap-4 text-sm">
            <div class="flex flex-wrap items-center gap-3">
              <UBadge
                color="success"
                variant="soft"
                icon="i-lucide-check"
                class="self-start"
              >
                <span class="flex items-center gap-2">
                  <UAvatar
                    v-if="identity.avatar"
                    :src="identity.avatar"
                    size="3xs"
                  />
                  Setting up for {{ identity.personaName }}
                </span>
              </UBadge>
              <UButton
                color="neutral"
                variant="link"
                class="p-0"
                @click="changeAccount"
              >
                Change account
              </UButton>
            </div>

            <UFormField label="API key" name="apiKey">
              <template #description>
                Create a key for {{ identity.personaName }} at
                <ULink :to="API_KEY_URL" target="_blank" class="underline">
                  steamcommunity.com/dev/apikey</ULink>
                  any domain name works. grate stores the key in its database,
                and you revoke it on the same page.
              </template>
              <UInput
                v-model="apiKey"
                type="password"
                class="w-full"
                @keyup.enter="connect"
              />
            </UFormField>

            <UAlert
              v-if="connectError"
              color="error"
              variant="soft"
              icon="i-lucide-triangle-alert"
              :description="connectError"
            />

            <UButton
              color="primary"
              class="self-start"
              :disabled="!apiKey"
              :loading="isConnecting"
              @click="connect"
            >
              Connect
            </UButton>
          </div>
        </template>
      </UStepper>

      <SteamQrLoginModal
        v-model:open="isIdentifyModalOpen"
        purpose="identify"
        @connected="onIdentifiedByQr"
      />
    </UCard>
  </AppPanel>
</template>
