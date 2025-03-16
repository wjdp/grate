<script setup lang="ts">
const links = {
  Games: "/games",
  Organise: "/organise",
  Tasks: "/debug/tasks",
};
const route = useRoute();
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="bg-slate-600 p-2">
      <NuxtLink to="/" class="mr-2 font-bold">grate</NuxtLink>
      <template v-for="(link, name, index) in links" :key="name">
        <span class="opacity-50">|</span>
        <NuxtLink
          :to="link"
          class="mx-2"
          :class="{ 'font-semibold': route.path === link }"
          >{{ name }}
        </NuxtLink>
      </template>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
