<script setup lang="ts">
const appConfig = useAppConfig()
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <p>Mornin {{ appConfig.title }}</p>
    <p><NuxtLink to="/state">State</NuxtLink></p>
  </div>
</template>
