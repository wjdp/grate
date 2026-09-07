<script setup lang="ts">
import { useDashboard } from "@nuxt/ui/utils/dashboard";

const route = useRoute();

const { toggleSidebar } = useDashboard({});

const tabs = [
  { label: "Home", icon: "i-lucide-house", to: "/" },
  { label: "Library", icon: "i-lucide-library-big", to: "/games" },
  { label: "Organise", icon: "i-lucide-list-checks", to: "/organise" },
  { label: "Activity", icon: "i-lucide-activity", to: "/activity" },
];

const isActive = (to: string) =>
  route.path === to || (to === "/games" && route.path.startsWith("/game/"));

const scrollPanelBodyToTop = () => {
  const body = document.querySelector<HTMLElement>(".app-panel-body");
  body?.scrollTo({ top: 0, behavior: "smooth" });
};

const onTabClick = (to: string) => {
  if (to === "/games" && route.path === "/games") scrollPanelBodyToTop();
};
</script>

<template>
  <nav
    aria-label="Primary"
    class="bg-elevated border-default fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
  >
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="flex flex-col items-center gap-0.5 py-2"
      :class="isActive(tab.to) ? 'text-primary' : 'text-muted'"
      :aria-current="isActive(tab.to) ? 'page' : undefined"
      @click="onTabClick(tab.to)"
    >
      <UIcon :name="tab.icon" class="size-5 shrink-0" />
      <span class="text-[11px] leading-none">{{ tab.label }}</span>
    </NuxtLink>

    <button
      type="button"
      class="text-muted flex flex-col items-center gap-0.5 py-2"
      aria-label="More"
      @click="toggleSidebar?.()"
    >
      <UIcon name="i-lucide-menu" class="size-5 shrink-0" />
      <span class="text-[11px] leading-none">More</span>
    </button>
  </nav>
</template>
