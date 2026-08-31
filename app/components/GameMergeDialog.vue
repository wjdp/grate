<script lang="ts" setup>
import type { GameDetail, GameWithProviders } from "#shared/types/Game";

const props = defineProps<{ game: GameDetail }>();
const emit = defineEmits<{ merged: [] }>();

const {
  data: gamesData,
  status,
  execute,
} = useFetch("/api/games", { immediate: false });

const open = ref(false);
const selected = ref<GameWithProviders | null>(null);
const pending = ref(false);
const error = ref<string | null>(null);

const providerSummary = (
  game: Pick<GameWithProviders, "steamGames" | "gogGames" | "epicGames">,
) => {
  const parts: string[] = [];
  if (game.steamGames.length) parts.push(`Steam ×${game.steamGames.length}`);
  if (game.gogGames.length) parts.push(`GOG ×${game.gogGames.length}`);
  if (game.epicGames.length) parts.push(`Epic ×${game.epicGames.length}`);
  return parts.join(", ") || "No provider rows";
};

const candidates = computed(() =>
  (gamesData.value?.games ?? []).filter(
    (candidate) => candidate.id !== props.game.id,
  ),
);

const groups = computed(() => [
  {
    id: "games",
    items: candidates.value.map((candidate) => ({
      id: candidate.id,
      label: candidate.name,
      suffix: `${providerSummary(candidate)} · ${formatPlaytime(candidate.playtimeMinutes) || "No playtime"}`,
      game: candidate,
      onSelect: () => {
        selected.value = candidate;
      },
    })),
  },
]);

const onOpen = () => {
  open.value = true;
  selected.value = null;
  error.value = null;
  if (status.value === "idle") execute();
};

const closeDialog = () => {
  open.value = false;
  selected.value = null;
  error.value = null;
};

const stateLost = (
  target: { state: string | null },
  source: { state: string | null },
) => Boolean(target.state && source.state && target.state !== source.state);

const merge = async (targetId: number, sourceIds: number[]) => {
  pending.value = true;
  error.value = null;
  try {
    const { game } = await $fetch("/api/games/merge", {
      method: "POST",
      body: { targetId, sourceIds },
    });
    if (game.id === props.game.id) {
      closeDialog();
      emit("merged");
    } else {
      await navigateTo(`/game/${game.id}`);
    }
  } catch (mergeError) {
    console.error(mergeError);
    error.value = "Could not merge these games.";
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <UModal
    v-model:open="open"
    title="Merge with another game"
    :ui="{ body: 'space-y-4' }"
  >
    <UButton
      variant="outline"
      color="neutral"
      icon="i-lucide-merge"
      label="Merge…"
      @click="onOpen"
    />

    <template #body>
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :description="error"
      />

      <UCommandPalette
        v-if="!selected"
        :groups="groups"
        :loading="status === 'pending'"
        placeholder="Search games by name…"
        class="h-80"
      >
        <template #item-leading="{ item }">
          <GameIcon :game="item.game" class="size-6 rounded" />
        </template>
        <template #empty>
          <p class="text-muted p-4 text-center text-sm">
            No games match that name.
          </p>
        </template>
      </UCommandPalette>

      <template v-else>
        <dl class="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
          <dt class="text-muted" />
          <dd class="text-highlighted font-medium">{{ game.name }}</dd>
          <dd class="text-highlighted font-medium">{{ selected.name }}</dd>

          <dt class="text-muted">Providers</dt>
          <dd>{{ providerSummary(game) }}</dd>
          <dd>{{ providerSummary(selected) }}</dd>

          <dt class="text-muted">Playtime</dt>
          <dd class="font-mono">
            {{ formatPlaytime(game.playtimeMinutes) || "None" }}
          </dd>
          <dd class="font-mono">
            {{ formatPlaytime(selected.playtimeMinutes) || "None" }}
          </dd>

          <dt class="text-muted">State</dt>
          <dd><GameStateBadge :state="game.state" /></dd>
          <dd><GameStateBadge :state="selected.state" /></dd>
        </dl>

        <UAlert
          v-if="stateLost(game, selected)"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          :description="`Merging into this game discards ${selected.name}’s state.`"
        />
        <UAlert
          v-else-if="stateLost(selected, game)"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          :description="`Merging into ${selected.name} discards this game’s state.`"
        />

        <div class="flex flex-wrap gap-2">
          <UButton
            color="primary"
            label="Merge into this game"
            :loading="pending"
            @click="merge(game.id, [selected.id])"
          />
          <UButton
            color="neutral"
            variant="outline"
            :label="`Merge into ${selected.name}`"
            :loading="pending"
            @click="merge(selected.id, [game.id])"
          />
          <UButton
            variant="ghost"
            color="neutral"
            label="Back"
            :disabled="pending"
            @click="selected = null"
          />
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            :disabled="pending"
            @click="closeDialog"
          />
        </div>
      </template>
    </template>
  </UModal>
</template>
