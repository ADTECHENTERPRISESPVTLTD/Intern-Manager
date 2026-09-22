import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FaceRegistration } from "./FaceRegistration";
import { ApiError, type VerificationService } from "./verificationService";

function setup(register: VerificationService["register"] = vi.fn().mockResolvedValue(undefined)) {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: vi.fn().mockResolvedValue(stream) }, configurable: true });
  const service = { register } as unknown as VerificationService;
  const onRegistered = vi.fn();
  render(<FaceRegistration service={service} onRegistered={onRegistered} />);
  return { register, track, onRegistered, user: userEvent.setup() };
}

async function capture(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.loadedData(await screen.findByLabelText("Live camera preview"));
  const button = await screen.findByRole("button", { name: "Capture Photo" });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}

describe("FaceRegistration", () => {
  it("explains privacy first, then takes 3 photos and uploads them together", async () => {
    const { register, track, onRegistered, user } = setup();
    expect(screen.getByText(/never your photos/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start Camera" }));

    for (const n of [1, 2, 3]) {
      expect(await screen.findByRole("heading", { name: `Photo ${n} of 3` })).toBeInTheDocument();
      await capture(user);
    }

    expect(await screen.findByRole("heading", { name: "Face Registered" })).toBeInTheDocument();
    expect(register).toHaveBeenCalledTimes(1);
    const frames = vi.mocked(register).mock.calls[0]![0];
    expect(frames).toHaveLength(3);
    frames.forEach((f) => expect(f).toBeInstanceOf(Blob));
    expect(track.stop).toHaveBeenCalled(); // camera off after the last photo
    expect(onRegistered).toHaveBeenCalled();
  });

  it("shows which photo was rejected and lets the intern start again", async () => {
    const register = vi.fn().mockRejectedValue(new ApiError(422, "MULTIPLE_FACES", "rejected", 1));
    const { user } = setup(register);
    await user.click(screen.getByRole("button", { name: "Start Camera" }));
    for (let i = 0; i < 3; i++) {
      await screen.findByRole("heading", { name: `Photo ${i + 1} of 3` });
      await capture(user);
    }
    expect(await screen.findByRole("heading", { name: "Multiple Faces Detected" })).toBeInTheDocument();
    expect(screen.getByText(/photo 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("does not claim success when the server is down", async () => {
    const register = vi.fn().mockRejectedValue(new ApiError(503, "SERVICE_ERROR", "down"));
    const { user, onRegistered } = setup(register);
    await user.click(screen.getByRole("button", { name: "Start Camera" }));
    for (let i = 0; i < 3; i++) {
      await screen.findByRole("heading", { name: `Photo ${i + 1} of 3` });
      await capture(user);
    }
    expect(await screen.findByRole("heading", { name: "Registration Unavailable" })).toBeInTheDocument();
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it("shows camera-permission help when the camera is blocked", async () => {
    const { user } = setup();
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" })) },
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: "Start Camera" }));
    expect(await screen.findByRole("heading", { name: "Camera Access Required" })).toBeInTheDocument();
  });
});
