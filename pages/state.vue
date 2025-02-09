<script lang="ts" setup>
const a = useState('a', ()=> 5);
const b = useState('b', ()=> 10);
const incrementB = () => b.value++;
const resetB = () => b.value = 0;
</script>

<template>
{{ a }} + {{ b }} = {{ a + b }}
<button @click="incrementB">Increment b</button>
<button @click="resetB">Reset b</button>
</template>
