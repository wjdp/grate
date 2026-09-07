<script setup lang="ts">
defineOptions({ inheritAttrs: false });

defineProps<{ title?: string }>();

defineSlots<{
  header?: () => unknown;
  default?: () => unknown;
}>();

const attrs = useAttrs();

const { open: openCommandPalette } = useCommandPalette();
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <slot name="header">
        <UDashboardNavbar
          :title="title"
          class="bg-elevated border-b border-default lg:hidden"
        >
          <template #toggle="{ toggleSidebar }">
            <UButton
              color="neutral"
              variant="ghost"
              aria-label="Open navigation"
              @click="toggleSidebar"
            >
              <img
                src="/icon.png"
                alt=""
                class="size-6 shrink-0 invert dark:invert-0"
              />
              <span
                class="font-display text-highlighted truncate text-lg font-semibold tracking-tight"
              >
                grate
              </span>
            </UButton>
          </template>

          <template #right>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-search"
              aria-label="Search"
              @click="openCommandPalette"
            />
          </template>
        </UDashboardNavbar>
      </slot>
    </template>

    <template #body>
      <div class="mx-auto w-full" :class="attrs.class">
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>
