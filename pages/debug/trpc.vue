<script setup lang="ts">
const { $client } = useNuxtApp()

const { data: hello } = await $client.hello.useQuery({ text: 'abc'})
</script>

<template>
  <div>
    <h1>Debug trpc</h1>
    <p>{{ hello?.greeting }}</p>
  </div>
</template>
