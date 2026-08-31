import { describe, expect, it } from "vitest";
import { runTaskBodySchema } from "./tasks";

describe("runTaskBodySchema", () => {
  it("accepts a task name without a payload", () => {
    expect(runTaskBodySchema.parse({ taskName: "sleep" })).toEqual({
      taskName: "sleep",
    });
  });

  it("accepts a provider payload", () => {
    expect(
      runTaskBodySchema.parse({
        taskName: "sleep",
        payload: { provider: "gog" },
      }),
    ).toEqual({ taskName: "sleep", payload: { provider: "gog" } });
  });

  it("accepts an empty payload", () => {
    expect(runTaskBodySchema.parse({ taskName: "sleep", payload: {} })).toEqual(
      { taskName: "sleep", payload: {} },
    );
  });

  it("rejects an unknown provider", () => {
    expect(() =>
      runTaskBodySchema.parse({
        taskName: "sleep",
        payload: { provider: "itch" },
      }),
    ).toThrow();
  });
});
