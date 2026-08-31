const WORD_OVERRIDES: Record<string, string> = {
  gog: "GOG",
  steam: "Steam",
  epic: "Epic",
};

export const humaniseTaskName = (taskName: string) => {
  const [first = "", ...rest] = taskName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[\s-_]+/)
    .map((word) => WORD_OVERRIDES[word] ?? word);
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
};
