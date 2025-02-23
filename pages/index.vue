<script setup lang="ts">
const appConfig = useAppConfig()

const {data} = useFetch(() => '/api/setup')
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <p>Mornin {{ appConfig.title }}</p>
    <p v-if="data && data.user">grate is configured</p>
    <p v-if="data && !data.user">grate needs setup</p>
    <p><NuxtLink to="/state">State</NuxtLink></p>
    <p><NuxtLink to="/games">Games</NuxtLink></p>
  </div>
</template>
