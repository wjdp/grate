export const useDuplicateCount = () =>
  useState<number | null>("duplicateCount", () => null);
