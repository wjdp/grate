<script setup lang="ts">
import {
  BACKDROP_LIGHT_MIN_BRIGHTNESS,
  BACKDROP_MIN_BRIGHTNESS,
  backdropBrightness,
  measureImageLuminance,
} from "~/utils/backdropBrightness";
import { isDarkLogo, measureLogoLuminance } from "~/utils/logoTone";

const props = defineProps<{
  background: string | null;
  logo: string | null;
  title: string;
}>();

const slots = useSlots();

const backgroundImage = useTemplateRef<HTMLImageElement>("backgroundImage");
const logoImage = useTemplateRef<HTMLImageElement>("logoImage");

const backgroundLuminance = ref<number | null>(null);
const logoLuminance = ref<number | null>(null);

// A dark wordmark would disappear under the usual dimming and dark gradient.
const darkLogo = computed(() => isDarkLogo(logoLuminance.value));

const minBrightness = computed(() =>
  darkLogo.value ? BACKDROP_LIGHT_MIN_BRIGHTNESS : BACKDROP_MIN_BRIGHTNESS,
);

const brightness = computed(() =>
  backgroundLuminance.value === null
    ? minBrightness.value
    : backdropBrightness(backgroundLuminance.value, minBrightness.value),
);

function measurable(image: HTMLImageElement | null): boolean {
  return Boolean(image?.complete) && (image?.naturalWidth ?? 0) > 0;
}

function measureBackground() {
  if (!measurable(backgroundImage.value)) {
    return;
  }
  backgroundLuminance.value = measureImageLuminance(
    backgroundImage.value as HTMLImageElement,
  );
}

function measureLogo() {
  if (!measurable(logoImage.value)) {
    return;
  }
  logoLuminance.value = measureLogoLuminance(
    logoImage.value as HTMLImageElement,
  );
}

// A cached image can finish loading before hydration attaches the listener.
onMounted(() => {
  measureBackground();
  measureLogo();
});

watch(
  () => props.background,
  () => {
    backgroundLuminance.value = null;
  },
);

watch(
  () => props.logo,
  () => {
    logoLuminance.value = null;
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
      class="absolute inset-0 size-full scale-110 object-cover transition-[filter] duration-300"
      :style="{ filter: `brightness(${brightness})` }"
      @load="measureBackground"
    />
    <div
      class="absolute inset-0 transition-opacity duration-300"
      :class="
        darkLogo
          ? 'bg-gradient-to-t from-(--ui-bg) via-transparent via-40% to-transparent'
          : 'bg-gradient-to-t from-(--ui-bg) via-(--ui-bg)/40 to-transparent'
      "
      aria-hidden="true"
    />
    <div class="relative flex min-h-48 items-end gap-4 p-6">
      <img
        v-if="logo"
        ref="logoImage"
        :src="logo"
        :alt="title"
        class="max-h-32 w-auto min-w-0 max-w-[min(100%,28rem)]"
        @load="measureLogo"
      />
      <h1
        v-else
        class="font-display text-highlighted text-3xl font-semibold tracking-tight"
      >
        {{ title }}
      </h1>
      <div
        v-if="slots.default"
        class="ml-auto"
        :class="
          darkLogo
            ? 'bg-(--ui-bg)/60 rounded-full px-2 py-1 backdrop-blur-sm'
            : undefined
        "
      >
        <slot />
      </div>
    </div>
  </div>
</template>
