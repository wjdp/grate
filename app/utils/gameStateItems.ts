import {
  type GameState,
  GameStateHues,
  GameStateIcons,
  GameStateNames,
} from "#shared/game-state";

export interface GameStateItem {
  value: GameState | null;
  label: string;
  icon: string;
  iconClass: string;
}

export const unsortedGameStateItem: GameStateItem = {
  value: null,
  label: "Unsorted",
  icon: "i-lucide-circle-dashed",
  iconClass: "text-grey-500 dark:text-grey-400",
};

export function gameStateItem(state: GameState): GameStateItem {
  return {
    value: state,
    label: GameStateNames[state],
    icon: GameStateIcons[state],
    iconClass: GameStateHues[state].icon,
  };
}

export const gameStateItemGroups: GameStateItem[][] = [
  [unsortedGameStateItem],
  [gameStateItem("BACKLOG")],
  [
    gameStateItem("PLAYING"),
    gameStateItem("PERIODIC"),
    gameStateItem("SHELVED"),
  ],
  [
    gameStateItem("PLAYED"),
    gameStateItem("COMPLETED"),
    gameStateItem("RETIRED"),
    gameStateItem("ABANDONED"),
  ],
  [gameStateItem("IGNORED")],
];
