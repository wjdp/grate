<script setup lang="ts">
const appConfig = useAppConfig();
</script>

<template>
  <UDashboardGroup>
    <AppSidebar />
    <UDashboardPanel :ui="{ body: 'mx-auto w-full max-w-7xl' }">
      <template #header>
        <UDashboardNavbar :title="appConfig.title" class="lg:hidden" />
      </template>
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
