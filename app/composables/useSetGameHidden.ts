import type { GameWithProviders } from "#shared/types/Game";

// Hiding a game drops it out of the library list, so unlike a state change the
// toast is the only feedback that anything happened.
export function useSetGameHidden() {
  const toast = useToast();
  const { data } = useNuxtData<{ games: GameWithProviders[] }>("games");

  return async function setGameHidden(
    game: GameWithProviders,
    hidden: boolean,
  ) {
    const previous = data.value;
    if (previous) {
      data.value = {
        ...previous,
        games: previous.games.map((entry) =>
          entry.id === game.id ? { ...entry, hidden } : entry,
        ),
      };
    }
    try {
      await $fetch(`/api/games/${game.id}/hidden`, {
        method: "PATCH",
        body: { hidden },
      });
      toast.add({
        title: hidden ? "Hidden from library" : "Shown in library",
        description: game.name,
        icon: hidden ? "i-lucide-eye-off" : "i-lucide-eye",
        color: "success",
      });
    } catch (error) {
      data.value = previous;
      toast.add({
        title: hidden ? "Could not hide game" : "Could not unhide game",
        description:
          error instanceof Error ? fetchErrorMessage(error) : undefined,
        icon: "i-lucide-triangle-alert",
        color: "error",
      });
    }
  };
}
