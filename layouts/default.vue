<template>
  <div class="min-h-screen bg-slate-900 p-2 text-white">
    <header>
      <NuxtLink to="/" class="font-bold">grate</NuxtLink> |
      <NuxtLink to="/games">Games</NuxtLink> |
      <NuxtLink to="/organise">Organise</NuxtLink>
    </header>
    <slot />
  </div>
</template>
