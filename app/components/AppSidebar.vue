<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

const { version } = useRuntimeConfig().public;

const duplicateCount = useDuplicateCount();
const { data: fetchedDuplicateCount } = useFetch("/api/games/duplicates", {
  transform: (data) => data.pairs.length,
});
watchEffect(() => {
  if (duplicateCount.value === null && fetchedDuplicateCount.value != null) {
    duplicateCount.value = fetchedDuplicateCount.value;
  }
});

const { open: openCommandPalette } = useCommandPalette();

const searchLinks: NavigationMenuItem[] = [
  {
    label: "Search",
    icon: "i-lucide-search",
    slot: "search",
    onSelect: openCommandPalette,
  },
];

const mainLinks = computed<NavigationMenuItem[]>(() => [
  { label: "Library", icon: "i-lucide-library-big", to: "/games" },
  { label: "Organise", icon: "i-lucide-list-checks", to: "/organise" },
  {
    label: "Duplicates",
    icon: "i-lucide-copy",
    to: "/duplicates",
    ...(duplicateCount.value ? { badge: duplicateCount.value } : {}),
  },
  { label: "Activity", icon: "i-lucide-activity", to: "/activity" },
  { label: "Providers", icon: "i-lucide-plug", to: "/providers" },
  { label: "Tasks", icon: "i-lucide-list-todo", to: "/tasks" },
]);

const debugLinks: NavigationMenuItem[] = [
  { label: "Debug", type: "label" },
  { label: "Components", icon: "i-lucide-component", to: "/debug/components" },
  { label: "Events", icon: "i-lucide-radio", to: "/debug/sse" },
  { label: "Steam art", icon: "i-lucide-image", to: "/debug/steam-art" },
];
</script>

<template>
  <UDashboardSidebar
    collapsible
    resizable
    :ui="{ footer: 'border-t border-default' }"
  >
    <template #header="{ collapsed }">
      <NuxtLink to="/" class="flex min-w-0 items-center gap-2">
        <img
          src="/icon.png"
          alt=""
          class="size-6 shrink-0 invert dark:invert-0"
        />
        <span
          v-if="!collapsed"
          class="font-display text-highlighted truncate text-lg font-semibold tracking-tight"
        >
          grate
        </span>
      </NuxtLink>
    </template>

    <template #default="{ collapsed }">
      <UNavigationMenu
        :items="searchLinks"
        :collapsed="collapsed"
        orientation="vertical"
        tooltip
      >
        <template #search-trailing>
          <span v-if="!collapsed" class="ms-auto flex items-center gap-0.5">
            <UKbd value="meta" />
            <UKbd value="k" />
          </span>
        </template>
      </UNavigationMenu>
      <UNavigationMenu
        :items="mainLinks"
        :collapsed="collapsed"
        orientation="vertical"
        tooltip
      />
      <UNavigationMenu
        :items="debugLinks"
        :collapsed="collapsed"
        orientation="vertical"
        tooltip
        class="mt-auto"
      />
    </template>

    <template #footer="{ collapsed }">
      <UColorModeButton />
      <span v-if="!collapsed" class="text-dimmed font-mono text-xs">
        v{{ version }}
      </span>
      <UDashboardSidebarCollapse class="ms-auto" />
    </template>
  </UDashboardSidebar>
</template>
