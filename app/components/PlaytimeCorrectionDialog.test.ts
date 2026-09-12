// @vitest-environment nuxt
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import UApp from "@nuxt/ui/components/App.vue";
import { createError, readBody } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import PlaytimeCorrectionDialog from "./PlaytimeCorrectionDialog.vue";

interface RecordedCall {
  path: string;
  method: string;
  body: unknown;
}

let calls: RecordedCall[] = [];
let rejectionMessage: string | null = null;

const record =
  (path: string) => async (event: Parameters<typeof readBody>[0]) => {
    const method = event.method;
    calls.push({
      path,
      method,
      body: method === "DELETE" ? null : await readBody(event),
    });
    if (rejectionMessage) {
      throw createError({
        statusCode: 400,
        statusMessage: rejectionMessage,
        message: rejectionMessage,
        data: { message: rejectionMessage },
      });
    }
    return { correction: { id: 9 } };
  };

registerEndpoint(
  "/api/games/7/corrections",
  record("/api/games/7/corrections"),
);
registerEndpoint(
  "/api/games/7/corrections/9",
  record("/api/games/7/corrections/9"),
);

type DialogProps = InstanceType<typeof PlaytimeCorrectionDialog>["$props"];

const mount = (props: Partial<DialogProps> = {}) =>
  mountSuspended(
    defineComponent({
      setup: () => () =>
        h(UApp, null, {
          default: () =>
            h(PlaytimeCorrectionDialog, {
              gameId: 7,
              provider: "gog",
              providerId: 1423049311,
              providerName: "Cyberpunk 2077",
              target: { snapshotId: 42, maxMinutes: 120 },
              open: true,
              ...props,
            }),
        }),
    }),
  );

const field = (testId: string) =>
  document.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);

const submitButton = () =>
  document.querySelector<HTMLButtonElement>(
    '[data-testid="correction-submit"]',
  );

const setField = async (testId: string, value: string) => {
  const input = field(testId);
  expect(input).not.toBeNull();
  input!.value = value;
  input!.dispatchEvent(new Event("input"));
  await nextTick();
  await nextTick();
};

beforeEach(() => {
  calls = [];
  rejectionMessage = null;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("PlaytimeCorrectionDialog", () => {
  it("prefills minutes from the target delta", async () => {
    await mount();

    expect(field("correction-minutes")?.value).toBe("120");
    expect(document.body.textContent).toContain("of 2h observed");
  });

  it("posts a correction against the target snapshot", async () => {
    await mount();
    await setField("correction-from", "2020-10-12T20:00");
    await setField("correction-to", "2020-10-12T22:00");

    submitButton()?.click();
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]).toStrictEqual({
      path: "/api/games/7/corrections",
      method: "POST",
      body: {
        provider: "gog",
        providerId: 1423049311,
        snapshotId: 42,
        minutes: 120,
        playedFrom: "2020-10-12T20:00",
        playedTo: "2020-10-12T22:00",
        note: null,
      },
    });
  });

  it("blocks submission of an invalid fuzzy date", async () => {
    await mount();
    await setField("correction-from", "last October");

    expect(submitButton()?.disabled).toBe(true);
    submitButton()?.click();
    await nextTick();
    expect(calls).toHaveLength(0);
  });

  it("blocks minutes beyond the observed delta", async () => {
    await mount();
    await setField("correction-from", "2020-10-12");
    await setField("correction-minutes", "121");

    expect(submitButton()?.disabled).toBe(true);
    expect(document.body.textContent).toContain("More than the 2h observed");
  });

  it("renders the server's message when the correction is rejected", async () => {
    rejectionMessage = "Correction ends after the store observed it";
    await mount();
    await setField("correction-from", "2020-10-12");

    submitButton()?.click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        "Correction ends after the store observed it",
      ),
    );
    expect(field("correction-from")?.value).toBe("2020-10-12");
  });

  it("patches an existing correction in edit mode", async () => {
    await mount({
      existing: {
        id: 9,
        minutes: 60,
        playedFrom: "2020-10",
        playedTo: "2020-10",
        note: null,
      },
    });

    expect(field("correction-from")?.value).toBe("2020-10");
    await setField("correction-minutes", "45");
    submitButton()?.click();
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]).toStrictEqual({
      path: "/api/games/7/corrections/9",
      method: "PATCH",
      body: {
        minutes: 45,
        playedFrom: "2020-10",
        playedTo: "2020-10",
        note: null,
      },
    });
  });
});
