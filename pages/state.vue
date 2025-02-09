<script lang="ts" setup>
const a = useState("a", () => 5);
const b = useState("b", () => 10);
const incrementB = () => b.value++;
const resetB = () => (b.value = 0);
</script>

<template>
  <div>
    <p>{{ a }} + {{ b }} = {{ a + b }}</p>
    <button @click="incrementB">Increment b</button>
    <button @click="resetB">Reset b</button>
  </div>
</template>
