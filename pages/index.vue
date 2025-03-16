<script setup lang="ts">
const appConfig = useAppConfig();

const { data } = useFetch(() => "/api/setup");
</script>

<template>
  <div class="p-4">
    <p>Mornin {{ appConfig.title }}</p>
    <p v-if="data && data.user">grate is configured</p>
    <p v-if="data && !data.user">grate needs setup</p>
  </div>
</template>
