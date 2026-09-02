// @vitest-environment nuxt
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SteamQrLoginModal from "./SteamQrLoginModal.vue";

const ATTEMPT_ID = "attempt-1";
const CHALLENGE_URL = "https://s.team/q/1/first";
const ROTATED_URL = "https://s.team/q/1/second";

let pollResponses: Array<Record<string, unknown>> = [];
let deleteCalls = 0;

registerEndpoint("/api/providers/steam/qr", () => ({
  id: ATTEMPT_ID,
  qrChallengeUrl: CHALLENGE_URL,
}));

registerEndpoint(`/api/providers/steam/qr/${ATTEMPT_ID}`, (event) => {
  if (event.method === "DELETE") {
    deleteCalls += 1;
    return { ok: true };
  }
  return (
    pollResponses.shift() ?? {
      state: "pending",
      qrChallengeUrl: CHALLENGE_URL,
    }
  );
});

let modal: Awaited<ReturnType<typeof mountSuspended>> | null = null;

const openModal = async () => {
  modal = await mountSuspended(SteamQrLoginModal, { props: { open: true } });
  await vi.waitFor(() => expect(document.body.innerHTML).toContain("<svg"));
  return modal;
};

beforeEach(() => {
  pollResponses = [];
  deleteCalls = 0;
});

afterEach(() => {
  modal?.unmount();
  modal = null;
  document.body.innerHTML = "";
});

describe("SteamQrLoginModal", () => {
  it("renders the QR code and the access warning", async () => {
    await openModal();

    expect(document.body.textContent).toContain("Connect Steam account");
    expect(document.body.textContent).toContain("Steam Guard");
    expect(document.body.textContent).toContain("Waiting for scan");
    expect(document.body.textContent).toContain(
      "This grants grate full access to your Steam account",
    );
    expect(document.body.innerHTML).toContain(
      "https://store.steampowered.com/account/authorizeddevices",
    );
  });

  it("re-renders the code when steam rotates the challenge", async () => {
    await openModal();
    const original = document.body.innerHTML;
    pollResponses = [{ state: "pending", qrChallengeUrl: ROTATED_URL }];

    await vi.waitFor(() => expect(document.body.innerHTML).not.toBe(original), {
      timeout: 8000,
    });

    expect(document.body.textContent).toContain("Waiting for scan");
  }, 15000);

  it("emits connected and closes once the scan is authenticated", async () => {
    const component = await openModal();
    pollResponses = [{ state: "authenticated", qrChallengeUrl: CHALLENGE_URL }];

    await vi.waitFor(
      () => expect(component.emitted("connected")).toBeTruthy(),
      {
        timeout: 8000,
      },
    );

    expect(component.emitted("update:open")?.at(-1)).toEqual([false]);
    expect(deleteCalls).toBe(0);
  }, 15000);

  it("offers another attempt once the code expires", async () => {
    await openModal();
    pollResponses = [{ state: "expired", qrChallengeUrl: CHALLENGE_URL }];

    await vi.waitFor(
      () => expect(document.body.textContent).toContain("QR code expired"),
      { timeout: 8000 },
    );

    expect(document.body.textContent).toContain("Try again");
  }, 15000);

  it("shows the error message steam login failed with", async () => {
    await openModal();
    pollResponses = [
      {
        state: "error",
        qrChallengeUrl: CHALLENGE_URL,
        message: "grate only supports a single Steam account",
      },
    ];

    await vi.waitFor(
      () =>
        expect(document.body.textContent).toContain(
          "grate only supports a single Steam account",
        ),
      { timeout: 8000 },
    );
  }, 15000);

  it("cancels a pending attempt when it closes", async () => {
    const component = await openModal();

    await component.setProps({ open: false });
    await vi.waitFor(() => expect(deleteCalls).toBe(1));
  });
});
