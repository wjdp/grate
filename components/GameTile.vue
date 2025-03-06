<script lang="ts" setup>
import type { GameWithSteam } from '~/shared/types/Game';

defineProps<{
    game: GameWithSteam;
}>();
</script>

<template>
    <li>
        <GameIcon :game='game' />
        <NuxtLink :to='`/game/${game.id}`'>{{ game.name }}</NuxtLink>
    </li>
</template>
