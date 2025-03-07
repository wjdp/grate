<template>
  <div class="min-h-screen bg-slate-900 text-white p-2">
    <header>
      <NuxtLink to="/" class="font-bold">grate</NuxtLink> |
      <NuxtLink to="/games">Games</NuxtLink>
    </header>
    <slot />
  </div>
</template>
