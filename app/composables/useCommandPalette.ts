export type CommandPalettePane =
  | { kind: "root" }
  | { kind: "game-actions"; gameId: number }
  | { kind: "set-state"; gameId: number };

/**
 * Global command palette state. UCommandPalette only nests panes it builds
 * itself from `children`, so the palette keeps its own stack: the last entry is
 * the visible pane, Backspace on an empty query pops, Escape closes.
 */
export const useCommandPalette = () => {
  const isOpen = useState("commandPaletteOpen", () => false);
  const panes = useState<CommandPalettePane[]>("commandPalettePanes", () => [
    { kind: "root" },
  ]);

  const pane = computed<CommandPalettePane>(
    () => panes.value.at(-1) ?? { kind: "root" },
  );
  const canPopPane = computed(() => panes.value.length > 1);

  const pushPane = (next: CommandPalettePane) => {
    panes.value = [...panes.value, next];
  };

  const popPane = () => {
    if (!canPopPane.value) return;
    panes.value = panes.value.slice(0, -1);
  };

  const open = () => {
    panes.value = [{ kind: "root" }];
    isOpen.value = true;
  };

  const openForGame = (gameId: number) => {
    panes.value = [{ kind: "root" }, { kind: "game-actions", gameId }];
    isOpen.value = true;
  };

  const close = () => {
    isOpen.value = false;
  };

  return {
    isOpen,
    panes,
    pane,
    canPopPane,
    pushPane,
    popPane,
    open,
    openForGame,
    close,
  };
};
