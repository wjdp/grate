import { describe, expect, it } from "vitest";
import mapWithConcurrency from "./mapWithConcurrency";

describe("mapWithConcurrency", () => {
  it("processes all items", async () => {
    const items = [1, 2, 3, 4, 5];
    const processed: number[] = [];

    await mapWithConcurrency(items, 2, async (item) => {
      processed.push(item);
    });

    expect(processed.sort()).toEqual(items);
  });

  it("never exceeds the concurrency limit", async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let inFlight = 0;
    let peakInFlight = 0;

    await mapWithConcurrency(items, 3, async () => {
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
    });

    expect(peakInFlight).toBeLessThanOrEqual(3);
    expect(peakInFlight).toBeGreaterThan(1);
  });

  it("propagates a worker error", async () => {
    const items = [1, 2, 3, 4, 5];

    await expect(
      mapWithConcurrency(items, 2, async (item) => {
        if (item === 3) {
          throw new Error("boom");
        }
      }),
    ).rejects.toThrow("boom");
  });
});
