import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { PresenceVerification } from "./PresenceVerification";
import type { CurrentCheck, VerificationStatus, VerifyResult } from "./types";
import { ApiError, type VerificationService } from "./verificationService";

// ---- Helpers ------------------------------------------------------------------------------
const check: CurrentCheck = {
  verificationId: "v-1",
  status: "PENDING",
  requestedAt: "2026-09-22T09:30:00Z",
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  attemptsUsed: 0,
  maxAttempts: 3,
};
const due: VerificationStatus = {
  sessionId: "s-1",
  verificationActive: true,
  verificationRequired: true,
  current: check,
  lastVerifiedAt: null,
  nextCheckDueAt: null,
  sessionVerificationStatus: "PENDING",
};
const notDue: VerificationStatus = { ...due, verificationRequired: false, current: null, sessionVerificationStatus: "VERIFIED" };

const verified: VerifyResult = {
  verificationId: "v-1",
  status: "VERIFIED",
  reason: null,
  attemptsRemaining: 2,
  closed: true,
  nextCheckDueAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  sessionVerificationStatus: "VERIFIED",
};
const failed = (reason: VerifyResult["reason"], attemptsRemaining = 2, closed = false): VerifyResult => ({
  ...verified,
  status: "FAILED",
  reason,
  attemptsRemaining,
  closed,
  nextCheckDueAt: null,
  sessionVerificationStatus: closed ? "UNVERIFIED" : "PENDING",
});

type MockedService = { [K in keyof VerificationService]: Mock<VerificationService[K]> };

function makeService(overrides: Partial<VerificationService> = {}): MockedService {
  return {
    getStatus: vi.fn().mockResolvedValue(due),
    requestCheck: vi.fn().mockResolvedValue(check),
    verify: vi.fn().mockResolvedValue(verified),
    getRegistration: vi.fn().mockResolvedValue({ registered: true }),
    register: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as MockedService;
}

function makeStream() {
  const track = { stop: vi.fn() };
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
}

function mockCamera(impl: () => Promise<MediaStream>) {
  const getUserMedia = vi.fn(impl);
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  return getUserMedia;
}

const domError = (name: string) => Object.assign(new Error(name), { name });

function renderPV(service: VerificationService, props: Partial<React.ComponentProps<typeof PresenceVerification>> = {}) {
  return render(<PresenceVerification service={service} pollIntervalMs={60_000} {...props} />);
}

/** Opens the camera from the popup and marks the preview as playing. */
async function openCamera(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Verify Presence" }));
  const video = await screen.findByLabelText("Live camera preview");
  fireEvent.loadedData(video);
  await waitFor(() => expect(screen.getByRole("button", { name: "Verify Now" })).toBeEnabled());
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---- Tests --------------------------------------------------------------------------------
describe("notification", () => {
  it("shows the popup when the backend says a check is due, without touching the camera yet", async () => {
    const getUserMedia = mockCamera(async () => makeStream().stream);
    renderPV(makeService());
    expect(await screen.findByRole("dialog", { name: "Presence Verification Required" })).toBeInTheDocument();
    expect(screen.getByText("Please verify your presence to continue your official work session.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("explains privacy before the camera turns on", async () => {
    renderPV(makeService());
    expect(await screen.findByText(/not saved/i)).toBeInTheDocument();
  });

  it("shows nothing when no check is due", async () => {
    const service = makeService({ getStatus: vi.fn().mockResolvedValue(notDue) });
    renderPV(service);
    await waitFor(() => expect(service.getStatus).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Cancel minimises to a banner; the banner reopens the popup", async () => {
    const user = userEvent.setup();
    renderPV(makeService());
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Your 30-minute presence check is now required.");
    await user.click(screen.getByRole("button", { name: "Verify Presence" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("Escape minimises the popup too", async () => {
    const user = userEvent.setup();
    renderPV(makeService());
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("reports every status to the host app", async () => {
    const onStatusChange = vi.fn();
    renderPV(makeService(), { onStatusChange });
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "s-1" })));
  });
});

describe("verifying with the camera", () => {
  it("opens the camera, sends one frame, turns the camera OFF before the answer arrives, then shows success", async () => {
    const { stream, track } = makeStream();
    const getUserMedia = mockCamera(async () => stream);
    let answer!: (r: VerifyResult) => void;
    const service = makeService({ verify: vi.fn(() => new Promise<VerifyResult>((res) => (answer = res))) });
    const user = userEvent.setup();
    renderPV(service);

    await openCamera(user);
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    expect(track.stop).not.toHaveBeenCalled(); // camera is on while positioning

    await user.click(screen.getByRole("button", { name: "Verify Now" }));
    expect(await screen.findByText("Verifying…")).toBeInTheDocument();
    expect(track.stop).toHaveBeenCalled(); // already off while waiting for the backend
    expect(service.verify).toHaveBeenCalledTimes(1);
    const [id, frame] = service.verify.mock.calls[0]!;
    expect(id).toBe("v-1");
    expect(frame).toBeInstanceOf(Blob);
    expect(frame.type).toBe("image/jpeg");

    await act(async () => answer(verified));
    expect(await screen.findByText("Presence Verified")).toBeInTheDocument();
    expect(screen.getByText("Your presence has been successfully verified.")).toBeInTheDocument();
    expect(screen.getByText(/Next verification: approximately 30 minutes/)).toBeInTheDocument();
  });

  it("a double click on Verify Now sends only one frame", async () => {
    mockCamera(async () => makeStream().stream);
    const service = makeService({ verify: vi.fn(() => new Promise<VerifyResult>(() => {})) });
    const user = userEvent.setup();
    renderPV(service);
    await openCamera(user);
    const button = screen.getByRole("button", { name: "Verify Now" });
    await user.dblClick(button);
    expect(service.verify).toHaveBeenCalledTimes(1);
  });

  it("re-encodes a too-large frame at lower quality so it stays under the size limit", async () => {
    mockCamera(async () => makeStream().stream);
    const qualities: number[] = [];
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, _type?: string, quality?: number) {
      qualities.push(quality ?? 0);
      cb(new Blob([new Uint8Array(qualities.length === 1 ? 400 * 1024 : 50 * 1024)], { type: "image/jpeg" }));
    };
    const service = makeService();
    const user = userEvent.setup();
    renderPV(service);
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Verify Now" }));
    await waitFor(() => expect(service.verify).toHaveBeenCalled());
    expect(qualities).toEqual([0.85, 0.7]);
    expect(service.verify.mock.calls[0]![1].size).toBe(50 * 1024);
  });

  it.each([
    ["NO_FACE", "No Face Detected", "Please position your face inside the camera frame."],
    ["MULTIPLE_FACES", "Multiple Faces Detected", "Only the registered intern should be visible during verification."],
    ["LOW_QUALITY", "Image Not Clear Enough", "Make sure lighting is sufficient and your face is clearly visible."],
    ["NO_MATCH", "Verification Failed", "We could not verify your presence."],
  ] as const)("%s: explains what went wrong, shows attempts left and lets the intern retry", async (reason, title, message) => {
    const getUserMedia = mockCamera(async () => makeStream().stream);
    const service = makeService({ verify: vi.fn().mockResolvedValue(failed(reason, 2)) });
    const user = userEvent.setup();
    renderPV(service);
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Verify Now" }));

    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByText("2 attempts remaining.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try Again" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });

  it("says '1 attempt' (singular) on the last try", async () => {
    mockCamera(async () => makeStream().stream);
    const service = makeService({ verify: vi.fn().mockResolvedValue(failed("NO_MATCH", 1)) });
    const user = userEvent.setup();
    renderPV(service);
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Verify Now" }));
    expect(await screen.findByText("1 attempt remaining.")).toBeInTheDocument();
  });

  it("when attempts run out it shows Presence Unverified with no retry", async () => {
    mockCamera(async () => makeStream().stream);
    const service = makeService({ verify: vi.fn().mockResolvedValue(failed("NO_MATCH", 0, true)) });
    const user = userEvent.setup();
    renderPV(service);
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Verify Now" }));
    expect(await screen.findByRole("heading", { name: "Presence Unverified" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try Again" })).not.toBeInTheDocument();
  });

  it("a broken face service is shown as 'unavailable', never as a failed verification", async () => {
    mockCamera(async () => makeStream().stream);
    const service = makeService({ verify: vi.fn().mockResolvedValue(failed("SERVICE_ERROR", 3)) });
    const user = userEvent.setup();
    renderPV(service);
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Verify Now" }));
    expect(await screen.findByRole("heading", { name: "Verification Unavailable" })).toBeInTheDocument();
    expect(screen.queryByText("Verification Failed")).not.toBeInTheDocument();
    expect(screen.getByText(/attempt was not counted/i)).toBeInTheDocument();
  });

  it("a network error while verifying lets the intern try again", async () => {
    mockCamera(async () => makeStream().stream);
    const service = makeService({ verify: vi.fn().mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "offline")) });
    const user = userEvent.setup();
    renderPV(service);
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Verify Now" }));
    expect(await screen.findByText(/Network problem/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("a rejected login token (401) tells the host app instead of showing an error", async () => {
    mockCamera(async () => makeStream().stream);
    const onSessionExpired = vi.fn();
    const service = makeService({ verify: vi.fn().mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "expired")) });
    const user = userEvent.setup();
    renderPV(service, { onSessionExpired });
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Verify Now" }));
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("if the window closed while answering, shows Presence Unverified", async () => {
    mockCamera(async () => makeStream().stream);
    const service = makeService({ verify: vi.fn().mockRejectedValue(new ApiError(409, "VERIFICATION_EXPIRED", "expired")) });
    const user = userEvent.setup();
    renderPV(service);
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Verify Now" }));
    expect(await screen.findByRole("heading", { name: "Presence Unverified" })).toBeInTheDocument();
  });

  it("the success message closes itself after a few seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockCamera(async () => makeStream().stream);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPV(makeService());
      await openCamera(user);
      await user.click(screen.getByRole("button", { name: "Verify Now" }));
      await screen.findByText("Presence Verified");
      await act(async () => vi.advanceTimersByTime(4100));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("camera problems", () => {
  it.each([
    ["NotAllowedError", "Camera Access Required", "Please allow camera access to complete your presence verification."],
    ["NotFoundError", "No Camera Found", "Connect a camera to this device, then try again."],
    ["NotReadableError", "Camera Unavailable", "Your camera may be in use by another app."],
  ])("%s shows '%s' and never counts as a failed attempt", async (errorName, title, text) => {
    mockCamera(async () => Promise.reject(domError(errorName)));
    const service = makeService();
    const user = userEvent.setup();
    renderPV(service);
    await user.click(await screen.findByRole("button", { name: "Verify Presence" }));
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeInTheDocument();
    expect(screen.getByText("This does not count as a failed attempt.")).toBeInTheDocument();
    expect(service.verify).not.toHaveBeenCalled();
  });

  it("a browser without camera support gets a clear message", async () => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    const user = userEvent.setup();
    renderPV(makeService());
    await user.click(await screen.findByRole("button", { name: "Verify Presence" }));
    expect(await screen.findByRole("heading", { name: "Camera Not Supported" })).toBeInTheDocument();
  });

  it("the intern can grant permission and try again", async () => {
    const { stream } = makeStream();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(domError("NotAllowedError"))
      .mockResolvedValueOnce(stream);
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    const user = userEvent.setup();
    renderPV(makeService());
    await user.click(await screen.findByRole("button", { name: "Verify Presence" }));
    await user.click(await screen.findByRole("button", { name: "Try Again" }));
    expect(await screen.findByLabelText("Live camera preview")).toBeInTheDocument();
  });

  it("closing the popup while the browser is asking for permission never leaves the camera on", async () => {
    const { stream, track } = makeStream();
    let grant!: (s: MediaStream) => void;
    mockCamera(() => new Promise<MediaStream>((res) => (grant = res)));
    const user = userEvent.setup();
    renderPV(makeService());
    await user.click(await screen.findByRole("button", { name: "Verify Presence" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await act(async () => grant(stream)); // user clicks "Allow" after the popup is already closed
    expect(track.stop).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaving the page releases the camera", async () => {
    const { stream, track } = makeStream();
    mockCamera(async () => stream);
    const user = userEvent.setup();
    const view = renderPV(makeService());
    await openCamera(user);
    view.unmount();
    expect(track.stop).toHaveBeenCalled();
  });

  it("Cancel while the camera is on turns it off", async () => {
    const { stream, track } = makeStream();
    mockCamera(async () => stream);
    const user = userEvent.setup();
    renderPV(makeService());
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(track.stop).toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument(); // still due, so the banner stays
  });

  it("nobody can dismiss the popup while the answer is pending", async () => {
    mockCamera(async () => makeStream().stream);
    const service = makeService({ verify: vi.fn(() => new Promise<VerifyResult>(() => {})) });
    const user = userEvent.setup();
    renderPV(service);
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Verify Now" }));
    await screen.findByText("Verifying…");
    await user.keyboard("{Escape}");
    expect(screen.getByText("Verifying…")).toBeInTheDocument();
  });
});

describe("registration and backend state", () => {
  it("an intern with no registered face is sent to registration and the camera stays off", async () => {
    const getUserMedia = mockCamera(async () => makeStream().stream);
    const onRegistrationRequired = vi.fn();
    const service = makeService({ getRegistration: vi.fn().mockResolvedValue({ registered: false }) });
    const user = userEvent.setup();
    renderPV(service, { onRegistrationRequired });
    await user.click(await screen.findByRole("button", { name: "Verify Presence" }));
    expect(await screen.findByRole("heading", { name: "Face Registration Required" })).toBeInTheDocument();
    expect(onRegistrationRequired).toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("if the check expires on the server while the popup is open, it says so", async () => {
    const getStatus = vi.fn().mockResolvedValueOnce(due).mockResolvedValue({ ...notDue, sessionVerificationStatus: "UNVERIFIED" });
    renderPV(makeService({ getStatus }), { pollIntervalMs: 40 });
    await screen.findByRole("dialog");
    expect(await screen.findByRole("heading", { name: "Presence Unverified" })).toBeInTheDocument();
    expect(screen.getByText(/verification window ended/i)).toBeInTheDocument();
  });

  it("when the official session is over the popup closes quietly", async () => {
    const getStatus = vi.fn().mockResolvedValueOnce(due).mockResolvedValue({ ...notDue, verificationActive: false });
    renderPV(makeService({ getStatus }), { pollIntervalMs: 40 });
    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText("Presence Unverified")).not.toBeInTheDocument();
  });

  it("warns (instead of staying silent) when the server cannot be reached", async () => {
    const getStatus = vi.fn().mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "offline"));
    renderPV(makeService({ getStatus }));
    expect(await screen.findByText(/Can't reach the server/)).toBeInTheDocument();
  });

  it("sends an expired login (401 on the status poll) to the host app", async () => {
    const onSessionExpired = vi.fn();
    const getStatus = vi.fn().mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "expired"));
    renderPV(makeService({ getStatus }), { onSessionExpired });
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });

  it("keeps polling the backend", async () => {
    const service = makeService({ getStatus: vi.fn().mockResolvedValue(notDue) });
    renderPV(service, { pollIntervalMs: 30 });
    await waitFor(() => expect(service.getStatus.mock.calls.length).toBeGreaterThanOrEqual(3));
  });
});

describe("privacy", () => {
  it("never writes anything to localStorage or sessionStorage during a full verification", async () => {
    const local = vi.spyOn(Storage.prototype, "setItem");
    mockCamera(async () => makeStream().stream);
    const user = userEvent.setup();
    renderPV(makeService());
    await openCamera(user);
    await user.click(screen.getByRole("button", { name: "Verify Now" }));
    await screen.findByText("Presence Verified");
    expect(local).not.toHaveBeenCalled();
  });
});
