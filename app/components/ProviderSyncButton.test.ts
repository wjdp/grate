// @vitest-environment nuxt
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "~~/server/tasks/queue";
import { emitTask, FakeEventSource } from "~~/test/fakeEventSource";
import ProviderSyncButton from "./ProviderSyncButton.vue";

const postedBodies: unknown[] = [];
let existingTasks: Task[] = [];

registerEndpoint("/api/tasks", async (event) => {
  if (event.method === "POST") {
    const { body } = event.node.req as unknown as { body: string };
    postedBodies.push(JSON.parse(body));
    return { id: 1, name: "sync", state: "pending" };
  }
  return existingTasks;
});

beforeEach(() => {
  postedBodies.length = 0;
  existingTasks = [];
  FakeEventSource.install();
});

describe("ProviderSyncButton", () => {
  it("queues a sync for its provider", async () => {
    const component = await mountSuspended(ProviderSyncButton, {
      props: { provider: "gog" as const },
    });

    expect(component.text()).toContain("Sync");
    await component.get("button").trigger("click");
    await vi.waitFor(() => expect(postedBodies).toHaveLength(1));

    expect(postedBodies[0]).toEqual({
      taskName: "sync",
      payload: { provider: "gog" },
    });
  });

  it("queues a payload-less sync when no provider is given", async () => {
    const component = await mountSuspended(ProviderSyncButton);

    expect(component.text()).toContain("Sync all");
    await component.get("button").trigger("click");
    await vi.waitFor(() => expect(postedBodies).toHaveLength(1));

    expect(postedBodies[0]).toEqual({ taskName: "sync" });
  });

  it("follows a sync for its own provider and disables the button", async () => {
    const component = await mountSuspended(ProviderSyncButton, {
      props: { provider: "steam" as const },
    });

    emitTask({
      id: 3,
      name: "sync",
      state: "in_progress",
      payload: { provider: "steam" },
      progress: 0.5,
      message: "Steam: updated 5/10 games",
    });
    await nextTick();

    expect(component.text()).toContain("Running");
    expect(component.text()).toContain("Steam: updated 5/10 games");
    expect(component.get("button").attributes("disabled")).toBeDefined();
  });

  it("follows a sync-all run, which covers every provider", async () => {
    const component = await mountSuspended(ProviderSyncButton, {
      props: { provider: "epic" as const },
    });

    emitTask({ id: 4, name: "sync", state: "pending" });
    await nextTick();

    expect(component.text()).toContain("Pending");
  });

  it("ignores syncs for a different provider", async () => {
    const component = await mountSuspended(ProviderSyncButton, {
      props: { provider: "epic" as const },
    });

    emitTask({
      id: 5,
      name: "sync",
      state: "in_progress",
      payload: { provider: "gog" },
    });
    await nextTick();

    expect(component.text()).not.toContain("Running");
    expect(component.get("button").attributes("disabled")).toBeUndefined();
  });

  it("seeds its state from a sync that is already running", async () => {
    existingTasks = [
      {
        id: 9,
        name: "sync",
        state: "in_progress",
        payload: { provider: "gog" },
      },
      { id: 8, name: "sync", state: "done", payload: { provider: "gog" } },
    ];

    const component = await mountSuspended(ProviderSyncButton, {
      props: { provider: "gog" as const },
    });

    await vi.waitFor(() => expect(component.text()).toContain("Running"));
  });
});
