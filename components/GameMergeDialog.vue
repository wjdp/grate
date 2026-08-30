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
const query = ref("");
const selected = ref<GameWithProviders | null>(null);
const pending = ref(false);
const error = ref<string | null>(null);

const MAX_MATCHES = 20;

const matches = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return [];
  return (gamesData.value?.games ?? [])
    .filter(
      (candidate) =>
        candidate.id !== props.game.id &&
        candidate.name.toLowerCase().includes(needle),
    )
    .slice(0, MAX_MATCHES);
});

const providerSummary = (
  game: Pick<GameWithProviders, "steamGames" | "gogGames" | "epicGames">,
) => {
  const parts: string[] = [];
  if (game.steamGames.length) parts.push(`Steam ×${game.steamGames.length}`);
  if (game.gogGames.length) parts.push(`GOG ×${game.gogGames.length}`);
  if (game.epicGames.length) parts.push(`Epic ×${game.epicGames.length}`);
  return parts.join(", ") || "No provider rows";
};

const openDialog = () => {
  open.value = true;
  error.value = null;
  if (status.value === "idle") execute();
};

const closeDialog = () => {
  open.value = false;
  selected.value = null;
  query.value = "";
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
  <section class="my-4">
    <Button v-if="!open" @click="openDialog">Merge…</Button>
    <div v-else class="border border-slate-600 p-3">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="text-lg font-bold">Merge with another game</h2>
        <Button class="bg-slate-600" @click="closeDialog">Close</Button>
      </div>

      <p v-if="error" class="my-2 text-red-400">{{ error }}</p>

      <template v-if="!selected">
        <input
          v-model="query"
          type="search"
          placeholder="Search games by name…"
          class="border-grey-300 my-2 w-full rounded border bg-slate-900 p-2 text-white"
        />
        <p v-if="status === 'pending'" class="text-grey-400">Loading games…</p>
        <p v-else-if="query.trim() && !matches.length" class="text-grey-400">
          No matches.
        </p>
        <ul v-else>
          <li v-for="match in matches" :key="match.id">
            <button
              class="w-full p-2 text-left hover:cursor-pointer hover:bg-slate-700"
              @click="selected = match"
            >
              <span class="font-semibold">{{ match.name }}</span>
              <span class="text-grey-400">
                — {{ providerSummary(match) }} ·
                {{ formatPlaytime(match.playtimeMinutes) || "No playtime" }}
              </span>
            </button>
          </li>
        </ul>
      </template>

      <template v-else>
        <table class="my-2">
          <thead>
            <tr class="text-left">
              <th class="p-1"></th>
              <th class="p-1">This game</th>
              <th class="p-1">Other game</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th class="p-1 text-left">Name</th>
              <td class="p-1">{{ game.name }}</td>
              <td class="p-1">{{ selected.name }}</td>
            </tr>
            <tr>
              <th class="p-1 text-left">Providers</th>
              <td class="p-1">{{ providerSummary(game) }}</td>
              <td class="p-1">{{ providerSummary(selected) }}</td>
            </tr>
            <tr>
              <th class="p-1 text-left">Playtime</th>
              <td class="p-1">
                {{ formatPlaytime(game.playtimeMinutes) || "None" }}
              </td>
              <td class="p-1">
                {{ formatPlaytime(selected.playtimeMinutes) || "None" }}
              </td>
            </tr>
            <tr>
              <th class="p-1 text-left">State</th>
              <td class="p-1">{{ game.state ?? "—" }}</td>
              <td class="p-1">{{ selected.state ?? "—" }}</td>
            </tr>
          </tbody>
        </table>

        <div class="my-2">
          <Button :disabled="pending" @click="merge(selected.id, [game.id])">
            Merge this into {{ selected.name }}
          </Button>
          <p class="text-grey-400 mt-1">
            Keeps {{ selected.name }}’s name and state.
            <span v-if="stateLost(selected, game)" class="text-yellow-400">
              This game’s state ({{ game.state }}) will be discarded.
            </span>
          </p>
        </div>

        <div class="my-2">
          <Button :disabled="pending" @click="merge(game.id, [selected.id])">
            Merge {{ selected.name }} into this
          </Button>
          <p class="text-grey-400 mt-1">
            Keeps {{ game.name }}’s name and state.
            <span v-if="stateLost(game, selected)" class="text-yellow-400">
              {{ selected.name }}’s state ({{ selected.state }}) will be
              discarded.
            </span>
          </p>
        </div>

        <Button
          class="bg-slate-600"
          :disabled="pending"
          @click="selected = null"
          >Back to search</Button
        >
      </template>
    </div>
  </section>
</template>
