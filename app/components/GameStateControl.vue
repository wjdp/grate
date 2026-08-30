<script lang="ts" setup>
import { GAME_STATES, type GameState } from "#shared/game-state";
const state = defineModel<GameState | null>();
</script>

<template>
  <SelectField v-model="state">
    <option :value="null">—</option>
    <option v-for="state in GAME_STATES" :key="state" :value="state">
      {{ state }}
    </option>
  </SelectField>
</template>
