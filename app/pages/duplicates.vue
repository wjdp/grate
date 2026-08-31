<script lang="ts" setup>
import type { DuplicatePair } from "#shared/types/Game";
import { getPageTitle } from "#shared/title";

useSeoMeta({ title: getPageTitle("Duplicate Games") });

const { data, status, refresh } = await useFetch("/api/games/duplicates");

const pairs = computed(() => data.value?.pairs ?? []);
const distinctPairs = computed(() => data.value?.distinct ?? []);

const pairKey = (pair: DuplicatePair) => `${pair.a.id}:${pair.b.id}`;

const pendingKey = ref<string | null>(null);
const errors = ref<Record<string, string>>({});

const runPairAction = async (
  pair: DuplicatePair,
  action: () => Promise<void>,
) => {
  const key = pairKey(pair);
  pendingKey.value = key;
  const { [key]: _cleared, ...rest } = errors.value;
  errors.value = rest;
  try {
    await action();
    await refresh();
  } catch (error) {
    console.error(error);
    errors.value = {
      ...errors.value,
      [key]: fetchErrorMessage(error as Error),
    };
  } finally {
    pendingKey.value = null;
  }
};

const keepGame = (pair: DuplicatePair, targetId: number, sourceId: number) =>
  runPairAction(pair, async () => {
    await $fetch("/api/games/merge", {
      method: "POST",
      body: { targetId, sourceIds: [sourceId] },
    });
  });

const markDistinct = (pair: DuplicatePair) =>
  runPairAction(pair, async () => {
    await $fetch("/api/games/distinct", {
      method: "POST",
      body: { gameAId: pair.a.id, gameBId: pair.b.id },
    });
  });

const undoingId = ref<number | null>(null);

const undoDistinct = async (id: number) => {
  undoingId.value = id;
  try {
    await $fetch(`/api/games/distinct/${id}`, { method: "DELETE" });
    await refresh();
  } catch (error) {
    console.error(error);
  } finally {
    undoingId.value = null;
  }
};

const formatCreated = (createdAt: string) =>
  new Date(createdAt).toLocaleDateString("en-GB");
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-6">
    <div>
      <h1
        class="font-display text-highlighted text-2xl font-semibold tracking-tight"
      >
        Duplicate Games
      </h1>
      <p class="text-muted mt-1 text-sm">
        Games with matching names across your providers. Nothing is ever merged
        automatically — check the release years before keeping a name.
      </p>
    </div>

    <div v-if="status === 'pending'" class="space-y-4">
      <USkeleton v-for="index in 3" :key="index" class="h-48 rounded-lg" />
    </div>

    <div v-else-if="pairs.length" class="space-y-4">
      <DuplicatePairCard
        v-for="pair in pairs"
        :key="pairKey(pair)"
        :pair="pair"
        :pending="pendingKey === pairKey(pair)"
        :error="errors[pairKey(pair)] ?? null"
        @keep="(targetId, sourceId) => keepGame(pair, targetId, sourceId)"
        @distinct="markDistinct(pair)"
      />
    </div>

    <div v-else class="flex flex-col items-center gap-3 py-16 text-center">
      <UIcon name="i-lucide-check-check" class="text-muted size-10" />
      <p class="text-highlighted text-lg font-medium">
        No duplicate suggestions
      </p>
      <UButton to="/games" color="neutral" variant="subtle">
        Back to library
      </UButton>
    </div>

    <UCollapsible v-if="distinctPairs.length" class="space-y-2">
      <UButton
        variant="ghost"
        color="neutral"
        trailing-icon="i-lucide-chevron-down"
        :label="`Marked as distinct (${distinctPairs.length})`"
        :ui="{
          trailingIcon:
            'group-data-[state=open]:rotate-180 transition-transform',
        }"
      />
      <template #content>
        <div class="border-default divide-default divide-y rounded-lg border">
          <div
            v-for="distinct in distinctPairs"
            :key="distinct.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
          >
            <NuxtLink
              :to="`/game/${distinct.a.id}`"
              :prefetch="false"
              class="text-highlighted hover:underline"
            >
              {{ distinct.a.name }}
            </NuxtLink>
            <span class="text-dimmed text-xs">and</span>
            <NuxtLink
              :to="`/game/${distinct.b.id}`"
              :prefetch="false"
              class="text-highlighted hover:underline"
            >
              {{ distinct.b.name }}
            </NuxtLink>
            <span class="text-dimmed ms-auto text-xs">
              {{ formatCreated(distinct.createdAt) }}
            </span>
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              icon="i-lucide-undo-2"
              label="Undo"
              :loading="undoingId === distinct.id"
              :disabled="undoingId !== null"
              @click="undoDistinct(distinct.id)"
            />
          </div>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
