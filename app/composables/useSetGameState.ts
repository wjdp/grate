import type { GameState } from "#shared/game-state";
import type { GameWithProviders } from "#shared/types/Game";

// The library list is cached under one key by every page that fetches it, so a
// state change can be patched straight into it rather than refetched.
export function useSetGameState() {
  const toast = useToast();
  const { data } = useNuxtData<{ games: GameWithProviders[] }>("games");

  return async function setGameState(
    game: GameWithProviders,
    state: GameState | null,
  ) {
    const previous = data.value;
    if (previous) {
      data.value = {
        ...previous,
        games: previous.games.map((entry) =>
          entry.id === game.id ? { ...entry, state } : entry,
        ),
      };
    }
    try {
      await $fetch(`/api/games/${game.id}/state`, {
        method: "PATCH",
        body: { state },
      });
    } catch (error) {
      data.value = previous;
      toast.add({
        title: "Could not set state",
        description:
          error instanceof Error ? fetchErrorMessage(error) : undefined,
        icon: "i-lucide-triangle-alert",
        color: "error",
      });
    }
  };
}
