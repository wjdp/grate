<script setup lang="ts">
import {
  PROVIDERS,
  type Provider,
  type ProviderFilter,
  ProviderLabels,
} from "#shared/providers";

interface ProviderItem {
  value: ProviderFilter;
  label: string;
}

const provider = defineModel<ProviderFilter>({ default: "all" });

const items: ProviderItem[] = [
  { value: "all", label: "All providers" },
  ...PROVIDERS.map((value) => ({ value, label: ProviderLabels[value] })),
];

const isProvider = (value: ProviderFilter): value is Provider =>
  value !== "all";
</script>

<template>
  <USelectMenu
    v-model="provider"
    :items="items"
    value-key="value"
    :search-input="false"
  >
    <template #leading>
      <ProviderIcon
        v-if="isProvider(provider)"
        :provider="provider"
        class="size-5 shrink-0"
      />
      <UIcon
        v-else
        name="i-lucide-layers"
        class="text-muted size-5 shrink-0"
      />
    </template>
    <template #item-leading="{ item }">
      <ProviderIcon
        v-if="isProvider(item.value)"
        :provider="item.value"
        class="size-5 shrink-0"
      />
      <UIcon
        v-else
        name="i-lucide-layers"
        class="text-muted size-5 shrink-0"
      />
    </template>
  </USelectMenu>
</template>
