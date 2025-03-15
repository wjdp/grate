<script setup lang="ts">
const links = {
  Games: "/games",
  Organise: "/organise",
  Tasks: "/debug/tasks",
};
</script>

<template>
  <div class="min-h-screen bg-slate-900 p-2 text-white">
    <header>
      <NuxtLink to="/" class="mr-2 font-bold">grate</NuxtLink>
      <template v-for="(link, name, index) in links" :key="name">
        <span class="opacity-50">|</span>
        <NuxtLink :to="link" class="mx-2">{{ name }}</NuxtLink>
      </template>
    </header>
    <slot />
  </div>
</template>
