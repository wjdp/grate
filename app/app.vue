<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator
      color="#fed250"
      :height="5"
      :throttle="100"
      :duration="1000"
    />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
