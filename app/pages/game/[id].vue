<script lang="ts" setup>
import { getGameArtUrls } from "#shared/art";
import type { GameState } from "#shared/game-state";
import { getPrimaryLaunch, ProviderLabels } from "#shared/providers";
import { getPageTitle } from "#shared/title";

const route = useRoute();
const id = parseIntRouteParam(route.params.id);
const { data, error: fetchError, refresh } = await useFetch(`/api/games/${id}`);

if (fetchError.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: "Game not found" });
}

const game = computed(() => data.value?.game);

if (game.value) useSeoMeta({ title: getPageTitle(game.value.name) });

const { data: timelineData, refresh: refreshTimeline } = await useFetch(
  `/api/games/${id}/timeline`,
);
const sessions = computed(() => timelineData.value?.sessions ?? []);
const undated = computed(() => timelineData.value?.undated ?? []);

const { data: correctionsData, refresh: refreshCorrections } = await useFetch(
  `/api/games/${id}/corrections`,
);
const corrections = computed(() => correctionsData.value?.corrections ?? []);

// Corrections change playtime and last played, so the game itself is refetched
// alongside the timeline.
const refreshPlaytime = async () => {
  await Promise.all([refresh(), refreshTimeline(), refreshCorrections()]);
};

const state = ref(game.value?.state ?? null);
watch(
  () => game.value?.state,
  (updatedState) => {
    state.value = updatedState ?? null;
  },
);

const art = computed(() => game.value && getGameArtUrls(game.value));

const { recordView } = useRecentlyViewedGames();
onMounted(() => {
  if (game.value) recordView(id);
});

// `useFetch` data is a shallowRef, so the optimistic update has to replace the
// object rather than write through it.
const applyGameState = (state: GameState | null) => {
  if (!data.value?.game) return;
  data.value = { ...data.value, game: { ...data.value.game, state } };
};

const updateGameState = async (state: GameState | null) => {
  if (!game.value) throw new Error("Game not loaded");
  const previousState = game.value.state;
  applyGameState(state);
  try {
    await $fetch(`/api/games/${id}/state`, {
      method: "PATCH",
      body: { state },
    });
  } catch (error) {
    console.error(error);
    applyGameState(previousState);
  }
};

const toast = useToast();

const applyGameHidden = (hidden: boolean) => {
  if (!data.value?.game) return;
  data.value = { ...data.value, game: { ...data.value.game, hidden } };
};

const updateGameHidden = async (hidden: boolean) => {
  if (!game.value) throw new Error("Game not loaded");
  const previousHidden = game.value.hidden;
  applyGameHidden(hidden);
  try {
    await $fetch(`/api/games/${id}/hidden`, {
      method: "PATCH",
      body: { hidden },
    });
  } catch (error) {
    applyGameHidden(previousHidden);
    toast.add({
      title: hidden ? "Could not hide game" : "Could not unhide game",
      description:
        error instanceof Error ? fetchErrorMessage(error) : undefined,
      icon: "i-lucide-triangle-alert",
      color: "error",
    });
  }
};

const onMerged = refreshPlaytime;

const steamGames = computed(() => game.value?.steamGames ?? []);
const gogGames = computed(() => game.value?.gogGames ?? []);
const epicGames = computed(() => game.value?.epicGames ?? []);

const description = computed(
  () =>
    steamGames.value[0]?.appInfo?.shortDescription ??
    gogGames.value[0]?.description ??
    epicGames.value[0]?.description ??
    null,
);

const providerCount = computed(
  () =>
    steamGames.value.length + gogGames.value.length + epicGames.value.length,
);

const primaryLaunch = computed(() =>
  game.value ? getPrimaryLaunch(game.value) : null,
);

interface CorrectableRow {
  provider: "steam" | "gog" | "epic";
  providerId: number;
  providerName: string;
}

const providerRows = computed<CorrectableRow[]>(() => [
  ...steamGames.value.map((row) => ({
    provider: "steam" as const,
    providerId: row.appId,
    providerName: row.name,
  })),
  ...gogGames.value.map((row) => ({
    provider: "gog" as const,
    providerId: row.gogId,
    providerName: row.name,
  })),
  ...epicGames.value.map((row) => ({
    provider: "epic" as const,
    providerId: row.epicId,
    providerName: row.name,
  })),
]);

const correctionOpen = ref(false);
const correctionRow = ref<CorrectableRow | null>(null);
const correctionTarget = ref<{ snapshotId: number; maxMinutes: number } | null>(
  null,
);
const correctionMode = ref<"correct" | "date">("correct");

const dateUndated = (entry: CorrectableRow & {
  snapshotId: number;
  minutes: number;
}) => {
  correctionRow.value = entry;
  correctionTarget.value = {
    snapshotId: entry.snapshotId,
    maxMinutes: entry.minutes,
  };
  correctionMode.value = "date";
  correctionOpen.value = true;
};

const addManualSession = (row: CorrectableRow) => {
  correctionRow.value = row;
  correctionTarget.value = null;
  correctionMode.value = "correct";
  correctionOpen.value = true;
};

const manualSessionItems = computed(() =>
  providerRows.value.map((row) => ({
    label: `${ProviderLabels[row.provider]} · ${row.providerName}`,
    onSelect: () => addManualSession(row),
  })),
);

</script>

<template>
  <AppPanel :title="game?.name" class="max-w-7xl space-y-6">
      <template v-if="game">
      <ArtHero
        :background="art?.background ?? null"
        :logo="art?.logo ?? null"
        :title="game.name"
      >
        <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
          <GameStateControl v-model="state" @change="updateGameState(state)" />
          <UButton
            color="neutral"
            variant="ghost"
            :icon="game.hidden ? 'i-lucide-eye' : 'i-lucide-eye-off'"
            :label="game.hidden ? 'Unhide' : 'Hide'"
            @click="updateGameHidden(!game.hidden)"
          />
          <PlayButton v-if="primaryLaunch" :href="primaryLaunch.playUrl" />
        </div>
      </ArtHero>

      <UAlert
        v-if="game.hidden"
        color="neutral"
        variant="soft"
        icon="i-lucide-eye-off"
        title="Hidden from your library"
        :actions="[
          {
            label: 'Unhide',
            color: 'neutral',
            variant: 'outline',
            onClick: () => updateGameHidden(false),
          },
        ]"
      />

      <div
        class="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8 lg:space-y-0"
      >
        <div
          class="grid grid-cols-2 gap-3 lg:order-last lg:grid-cols-1 lg:gap-2.5"
        >
          <StatTile
            class="lg:p-3"
            label="Playtime"
            icon="i-lucide-clock"
            :value="formatPlaytime(game.playtimeMinutes) || 'None'"
          />
          <StatTile
            class="lg:p-3"
            label="Last played"
            icon="i-lucide-calendar"
            :value="
              game.lastPlayedAt ? formatLastPlayed(game.lastPlayedAt) : 'Never'
            "
          />
          <StatTile
            class="lg:p-3"
            label="Providers"
            icon="i-lucide-library"
            :value="providerCount"
          />
          <StatTile class="lg:p-3" label="State" icon="i-lucide-tag">
            <GameStateBadge :state="game.state" />
          </StatTile>
        </div>

        <div class="min-w-0 space-y-6">
          <CollapsibleText
            v-if="description"
            :text="description"
            class="text-muted max-w-prose"
          />

          <GameProviderRows :game="game" />

          <section class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-display text-highlighted text-lg font-semibold">
                History
              </h2>
              <div class="flex items-center gap-1">
                <UDropdownMenu
                  v-if="manualSessionItems.length > 1"
                  :items="manualSessionItems"
                >
                  <UButton
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    icon="i-lucide-plus"
                    label="Add session"
                  />
                </UDropdownMenu>
                <UButton
                  v-else-if="providerRows[0]"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  icon="i-lucide-plus"
                  label="Add session"
                  @click="addManualSession(providerRows[0])"
                />
                <PlaytimeRawHistoryModal :game-id="id" />
              </div>
            </div>

            <ul v-if="undated.length" class="space-y-1">
              <li
                v-for="entry in undated"
                :key="`${entry.provider}-${entry.providerId}`"
                class="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              >
                <ProviderIcon :provider="entry.provider" />
                <span>{{ entry.providerName }}</span>
                <span>·</span>
                <span class="tabular-nums">
                  {{ formatPlaytime(entry.minutes) }} before grate started
                  watching
                </span>
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  label="Date this…"
                  @click="dateUndated(entry)"
                />
              </li>
            </ul>

            <PlaytimeSessionList
              :sessions="sessions"
              :game-id="id"
              :corrections="corrections"
              @changed="refreshPlaytime"
            />

            <PlaytimeCorrectionDialog
              v-if="correctionRow"
              v-model:open="correctionOpen"
              :game-id="id"
              :provider="correctionRow.provider"
              :provider-id="correctionRow.providerId"
              :provider-name="correctionRow.providerName"
              :target="correctionTarget"
              :mode="correctionMode"
              @saved="refreshPlaytime"
            />
          </section>

          <section class="space-y-3">
            <h2 class="font-display text-highlighted text-lg font-semibold">
              Manage
            </h2>
            <p class="text-muted max-w-prose text-sm">
              Merge this game with another entry, or split a provider row into its
              own game from the provider cards above.
            </p>
            <GameMergeDialog :game="game" @merged="onMerged" />
          </section>
        </div>
      </div>
    </template>
  </AppPanel>
</template>
