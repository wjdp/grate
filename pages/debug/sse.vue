<script lang="ts" setup>
const { onMessage, open } = useSseClient();
const messages = ref<string[]>([]);
onMessage("message", (event) => {
  messages.value.push(`Message: ${event.message}`);
});
onMessage("notification", (event) => {
  messages.value.push(`${event.title}: ${event.message}`);
});
</script>

<template>
  <div>
    <h1>Server-Sent Events</h1>
    <p v-if="open">We're open</p>
    <p v-else>Not open</p>
    <ul>
      <li v-for="message in messages" :key="message">{{ message }}</li>
    </ul>
  </div>
</template>
