<script lang="ts" setup>
import { GameState } from "@prisma/client";
const state = defineModel<GameState | null>();
</script>

<template>
  <SelectField v-model="state">
    <option :value="null">—</option>
    <option
      v-for="state in Object.values(GameState)"
      :key="state"
      :value="state"
    >
      {{ state }}
    </option>
  </SelectField>
</template>
