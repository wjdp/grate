<template>
  <UDashboardGroup>
    <AppSidebar />
    <UDashboardPanel>
      <template #header>
        <AppNavbar class="lg:hidden" />
      </template>
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
    <AppCommandPalette />
  </UDashboardGroup>
</template>
