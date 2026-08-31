<script setup lang="ts">
import type { Provider } from "#shared/providers";
import type { DuplicatePair } from "#shared/types/Game";

type PairSide = DuplicatePair["a"];

const props = defineProps<{
  pair: DuplicatePair;
  pending?: boolean;
  error?: string | null;
}>();

defineEmits<{
  keep: [targetId: number, sourceId: number];
  distinct: [];
}>();

const providersOf = (side: PairSide): Provider[] => {
  const found: Provider[] = [];
  if (side.steamGames.length) found.push("steam");
  if (side.gogGames.length) found.push("gog");
  if (side.epicGames.length) found.push("epic");
  return found;
};

const sides = computed(() => [props.pair.a, props.pair.b]);

const otherSide = (side: PairSide) =>
  side.id === props.pair.a.id ? props.pair.b : props.pair.a;

const yearsDiffer = computed(
  () =>
    props.pair.a.releaseYear !== null &&
    props.pair.b.releaseYear !== null &&
    props.pair.a.releaseYear !== props.pair.b.releaseYear,
);

const discardsState = (side: PairSide) => {
  const other = otherSide(side);
  return Boolean(side.state && other.state && side.state !== other.state);
};
</script>

<template>
  <UCard :ui="{ body: 'space-y-4' }">
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :description="error"
      class="mb-4"
    />

    <div class="grid gap-4 sm:grid-cols-2">
      <div
        v-for="side in sides"
        :key="side.id"
        class="border-default flex flex-col gap-3 rounded-lg border p-3"
      >
        <div class="flex items-start gap-3">
          <GameIcon :game="side" class="size-10 shrink-0 rounded-md" />
          <div class="min-w-0 flex-1">
            <NuxtLink
              :to="`/game/${side.id}`"
              :prefetch="false"
              class="text-highlighted text-sm font-medium hover:underline"
            >
              {{ side.name }}
            </NuxtLink>
            <div class="text-dimmed mt-1 flex items-center gap-1.5">
              <ProviderIcon
                v-for="provider in providersOf(side)"
                :key="provider"
                :provider="provider"
                class="size-3.5"
              />
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            variant="soft"
            :color="yearsDiffer ? 'warning' : 'neutral'"
            size="sm"
            icon="i-lucide-calendar"
            :label="
              side.releaseYear ? String(side.releaseYear) : 'Year unknown'
            "
          />
          <GameStateBadge :state="side.state" size="sm" />
          <span class="text-muted text-xs tabular-nums">
            {{ formatPlaytime(side.playtimeMinutes) || "Unplayed" }}
          </span>
        </div>

        <UAlert
          v-if="discardsState(side)"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          :description="`Keeping this name discards ${otherSide(side).name}’s state.`"
          :ui="{ description: 'text-xs' }"
        />

        <UButton
          color="primary"
          variant="soft"
          size="sm"
          icon="i-lucide-merge"
          label="Keep this name"
          block
          class="mt-auto"
          :loading="pending"
          :disabled="pending"
          @click="$emit('keep', side.id, otherSide(side).id)"
        />
      </div>
    </div>

    <div class="flex justify-center">
      <UButton
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-lucide-split"
        label="Not the same"
        :disabled="pending"
        @click="$emit('distinct')"
      />
    </div>
  </UCard>
</template>
