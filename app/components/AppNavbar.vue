<script setup lang="ts">
const { open: openCommandPalette } = useCommandPalette();
</script>

<template>
  <UDashboardNavbar>
    <template #toggle="{ toggleSidebar }">
      <UButton
        color="neutral"
        variant="ghost"
        aria-label="Open navigation"
        @click="toggleSidebar"
      >
        <img
          src="/icon.png"
          alt=""
          class="size-6 shrink-0 invert dark:invert-0"
        />
        <span class="font-display text-highlighted truncate text-lg font-semibold tracking-tight">
            grate
        </span>
      </UButton>
    </template>

    <template #right>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-search"
        aria-label="Search"
        @click="openCommandPalette"
      />
    </template>
  </UDashboardNavbar>
</template>
