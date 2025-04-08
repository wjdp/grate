<script setup lang="ts">
const links = {
  Games: "/games",
  Organise: "/organise",
  Tasks: "/debug/tasks",
  Components: "/debug/components",
};
const route = useRoute();
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="border-b border-slate-700 bg-zinc-900/50 p-4">
      <nav class="flex max-w-screen-lg items-center gap-4">
        <div>
          <!-- TODO replace with an SVG -->
          <img src="/icon.png" alt="Logo" class="mr-1.5 inline-block w-5" />
          <NuxtLink
            to="/"
            class="bg-gradient-to-br from-slate-200 to-slate-400 bg-clip-text text-xl font-bold text-slate-400 text-transparent hover:text-slate-300"
            >grate</NuxtLink
          >
        </div>
        <div class="flex items-center gap-2">
          <template v-for="(link, name) in links" :key="name">
            <NuxtLink
              :to="link"
              class="rounded-md px-3 py-2 text-sm transition-colors hover:bg-slate-700"
              :class="{
                'bg-slate-700 font-semibold text-slate-100':
                  route.path === link,
              }"
              >{{ name }}
            </NuxtLink>
          </template>
        </div>
      </nav>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
