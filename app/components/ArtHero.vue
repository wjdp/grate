<script setup lang="ts">
import {
  BACKDROP_MIN_BRIGHTNESS,
  backdropBrightness,
  measureImageLuminance,
} from "~/utils/backdropBrightness";

const props = defineProps<{
  background: string | null;
  logo: string | null;
  title: string;
}>();

const backgroundImage = useTemplateRef<HTMLImageElement>("backgroundImage");
const brightness = ref(BACKDROP_MIN_BRIGHTNESS);

function measureBackground() {
  const image = backgroundImage.value;
  if (!image?.complete || image.naturalWidth === 0) {
    return;
  }
  const luminance = measureImageLuminance(image);
  brightness.value =
    luminance === null ? BACKDROP_MIN_BRIGHTNESS : backdropBrightness(luminance);
}

// A cached image can finish loading before hydration attaches the listener.
onMounted(measureBackground);
watch(
  () => props.background,
  () => {
    brightness.value = BACKDROP_MIN_BRIGHTNESS;
  },
);
</script>

<template>
  <div class="bg-elevated relative isolate overflow-hidden rounded-lg">
    <img
      v-if="background"
      ref="backgroundImage"
      :src="background"
      alt=""
      aria-hidden="true"
      class="absolute inset-0 size-full scale-110 object-cover"
      :style="{ filter: `brightness(${brightness})` }"
      @load="measureBackground"
    />
    <div
      class="absolute inset-0 bg-gradient-to-t from-(--ui-bg) via-(--ui-bg)/40 to-transparent"
      aria-hidden="true"
    />
    <div class="relative flex min-h-48 items-end gap-4 p-6">
      <img
        v-if="logo"
        :src="logo"
        :alt="title"
        class="max-h-32 w-auto max-w-full"
      />
      <h1
        v-else
        class="font-display text-highlighted text-3xl font-semibold tracking-tight"
      >
        {{ title }}
      </h1>
      <slot />
    </div>
  </div>
</template>
