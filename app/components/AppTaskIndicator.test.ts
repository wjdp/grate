// @vitest-environment nuxt
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it } from "vitest";
import { emitTask, FakeEventSource } from "~~/test/fakeEventSource";
import AppTaskIndicator from "./AppTaskIndicator.vue";

registerEndpoint("/api/tasks", () => []);

beforeEach(() => {
  FakeEventSource.install();
});

describe("AppTaskIndicator", () => {
  it("shows nothing while no task is running", async () => {
    const component = await mountSuspended(AppTaskIndicator);

    expect(component.find("a").exists()).toBe(false);
  });

  it("shows the running task and links to the tasks page", async () => {
    const component = await mountSuspended(AppTaskIndicator);

    emitTask({
      id: 1,
      name: "recordPlaytimes",
      state: "in_progress",
      progress: 0.25,
      message: "GOG: 3/12 games",
    });
    await nextTick();

    expect(component.get("a").attributes("href")).toBe("/tasks");
    expect(component.text()).toContain("Record playtimes");
    expect(component.text()).toContain("GOG: 3/12 games");
  });

  it("hides again once the task finishes", async () => {
    const component = await mountSuspended(AppTaskIndicator);

    emitTask({ id: 2, name: "sync", state: "in_progress" });
    await nextTick();
    expect(component.find("a").exists()).toBe(true);

    emitTask({ id: 2, name: "sync", state: "done" });
    await nextTick();
    expect(component.find("a").exists()).toBe(false);
  });

  it("shows only the icon when the sidebar is collapsed", async () => {
    const component = await mountSuspended(AppTaskIndicator, {
      props: { collapsed: true },
    });

    emitTask({ id: 3, name: "sync", state: "in_progress", message: "Steam" });
    await nextTick();

    expect(component.find("a").exists()).toBe(true);
    expect(component.text()).not.toContain("Steam");
  });
});
