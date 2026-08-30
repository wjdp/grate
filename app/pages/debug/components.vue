<script setup lang="ts">
import { GAME_STATES, type GameState } from "#shared/game-state";
import type { SseTask } from "~~/lib/hooks";

const taskStates: SseTask["state"][] = [
  "pending",
  "in_progress",
  "done",
  "failed",
];

const controlState = ref<GameState | null>(null);
</script>

<template>
  <div class="flex flex-col gap-8">
    <h1 class="font-display text-highlighted text-2xl font-semibold">
      Components
    </h1>

    <section class="flex flex-col gap-3">
      <h2 class="text-highlighted font-semibold">Game state badges</h2>
      <div class="flex flex-wrap gap-2">
        <GameStateBadge :state="null" />
        <GameStateBadge
          v-for="state in GAME_STATES"
          :key="state"
          :state="state"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-highlighted font-semibold">Game state control</h2>
      <GameStateControl v-model="controlState" />
      <p class="text-muted text-sm">Selected: {{ controlState ?? "null" }}</p>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-highlighted font-semibold">Task states</h2>
      <div class="flex flex-wrap gap-2">
        <TaskState v-for="state in taskStates" :key="state" :state="state" />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-highlighted font-semibold">Stat tiles</h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Games" :value="1234" icon="i-lucide-library-big" />
        <StatTile label="Playtime" value="812 h" icon="i-lucide-hourglass" />
        <StatTile label="Unsorted" :value="42" icon="i-lucide-circle-dashed" />
        <StatTile label="Providers" :value="3" icon="i-lucide-plug" />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-highlighted font-semibold">Provider icons</h2>
      <div class="flex items-center gap-4 text-2xl">
        <ProviderIcon provider="steam" />
        <ProviderIcon provider="gog" />
        <ProviderIcon provider="epic" />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-highlighted font-semibold">Play button</h2>
      <div><PlayButton href="steam://run/440" /></div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-highlighted font-semibold">Art hero</h2>
      <ArtHero :background="null" :header="null" title="A game with no art" />
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-highlighted font-semibold">History grid</h2>
      <HistoryGrid class="max-w-[64rem]" :year="2025" />
    </section>
  </div>
</template>
