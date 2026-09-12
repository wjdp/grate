process.env.TZ = "UTC";

import { describe, expect, it } from "vitest";
import {
  formatImprecisePlaytime,
  impreciseMinutes,
} from "./formatImprecisePlaytime";

describe("formatImprecisePlaytime", () => {
  it("lists month totals", () => {
    expect(
      formatImprecisePlaytime(
        {
          months: [
            { month: "2020-10", minutes: 360 },
            { month: "2020-11", minutes: 120 },
          ],
          yearOnly: 0,
        },
        2020,
      ),
    ).toBe("Plus 8h imprecisely dated: Oct 6h, Nov 2h");
  });

  it("appends year-only playtime", () => {
    expect(
      formatImprecisePlaytime(
        { months: [{ month: "2020-10", minutes: 360 }], yearOnly: 90 },
        2020,
      ),
    ).toBe("Plus 7h 30m imprecisely dated: Oct 6h, sometime in 2020 1h 30m");
  });

  it("returns nothing when there is no imprecise playtime", () => {
    expect(
      formatImprecisePlaytime({ months: [], yearOnly: 0 }, 2020),
    ).toBeNull();
  });

  it("sums every imprecise bucket", () => {
    expect(
      impreciseMinutes({
        months: [
          { month: "2020-10", minutes: 360 },
          { month: "2020-11", minutes: 120 },
        ],
        yearOnly: 90,
      }),
    ).toBe(570);
  });
});
