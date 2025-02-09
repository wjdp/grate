<script setup lang="ts">
const appConfig = useAppConfig()
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <p>Mornin {{ appConfig.title }}</p>
  </div>
</template>
