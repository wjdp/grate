<script setup lang="ts">
const { $client } = useNuxtApp()

const { data: hello, status, refresh } = await $client.hello.useQuery({ text: 'abc'})
</script>

<template>
  <div>
    <h1>Debug trpc</h1>
    <p>{{ status }}</p>
    <p>{{ hello?.greeting }}</p>
    <button @click="refresh()">Refresh</button>
  </div>
</template>
