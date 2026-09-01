<script setup lang="ts">
defineProps<{ title?: string }>();

const { open: openCommandPalette } = useCommandPalette();
</script>

<template>
  <UDashboardNavbar :title="title">
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
