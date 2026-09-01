<script setup lang="ts">
const appConfig = useAppConfig();
</script>

<template>
  <UDashboardGroup>
    <AppSidebar />
    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar :title="appConfig.title" class="lg:hidden" />
      </template>
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
    <AppCommandPalette />
  </UDashboardGroup>
</template>
