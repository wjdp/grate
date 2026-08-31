<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text: string;
    lines?: number;
  }>(),
  { lines: 4 },
);

const expanded = ref(false);
const overflowing = ref(false);
const textEl = useTemplateRef("textEl");

const clampStyle = computed(() =>
  expanded.value
    ? undefined
    : {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as const,
        WebkitLineClamp: props.lines,
        overflow: "hidden",
      },
);

function measureOverflow() {
  if (expanded.value) return;
  const el = textEl.value;
  if (!el) return;
  overflowing.value = el.scrollHeight > el.clientHeight;
}

onMounted(() => {
  measureOverflow();
  window.addEventListener("resize", measureOverflow);
});

onUnmounted(() => {
  window.removeEventListener("resize", measureOverflow);
});

watch(
  () => props.text,
  () => {
    expanded.value = false;
    nextTick(measureOverflow);
  },
);
</script>

<template>
  <div>
    <p ref="textEl" :style="clampStyle">{{ text }}</p>
    <UButton
      v-if="overflowing"
      variant="outline"
      color="neutral"
      size="sm"
      class="px-2 py-0.5"
      :label="expanded ? 'Show less' : 'Show more'"
      @click="expanded = !expanded"
    />
  </div>
</template>
