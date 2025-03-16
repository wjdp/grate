<script setup lang="ts">
import { reactive } from "vue";
import { logEvent } from "histoire/client";

const state = reactive({
  disabled: false,
  text: "Hello world",
});
</script>

<template>
  <Story title="Button">
    <Button :disabled="state.disabled" @click="logEvent('click', $event)"
      >{{ state.text }}
    </Button>

    <template #controls>
      <HstText title="Button Text" v-model="state.text" />
      <HstCheckbox title="Disabled" v-model="state.disabled" />
    </template>
  </Story>
</template>
