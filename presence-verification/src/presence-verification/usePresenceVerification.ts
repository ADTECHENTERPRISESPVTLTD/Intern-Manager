import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera } from "./useCamera";
import { ApiError, type VerificationService } from "./verificationService";
import type { CameraErrorKind, CurrentCheck, FailureReason, VerificationStatus, VerifyResult } from "./types";

export type Phase =
  | { name: "hidden" } // nothing due
  | { name: "intro" } // check due, popup open, camera still off
  | { name: "banner" } // check due, popup minimised to a banner
  | { name: "starting" } // waiting for the browser's camera permission
  | { name: "ready" } // live preview, intern can press Verify
  | { name: "verifying" } // frame sent, waiting for the backend's answer
  | { name: "retry"; reason: FailureReason; attemptsRemaining: number }
  | { name: "cameraError"; kind: CameraErrorKind }
  | { name: "unavailable"; message: string } // backend/face service/network problem; attempt not used
  | { name: "notRegistered" }
  | { name: "result"; outcome: "verified" | "unverified" | "expired"; nextCheckDueAt: string | null };

const OPEN_PHASES = new Set<Phase["name"]>(["intro", "banner", "starting", "ready", "retry", "cameraError", "unavailable", "notRegistered"]);
export const isModalPhase = (p: Phase) => p.name !== "hidden" && p.name !== "banner";

export interface Options {
  service: VerificationService;
  pollIntervalMs?: number;
  /** Called after every status refresh so the dashboard can update its session card. */
  onStatusChange?: (status: VerificationStatus) => void;
  /** The login token was rejected. The host app should send the user to log in. */
  onSessionExpired?: () => void;
  /** The intern has no registered face: the host should show <FaceRegistration />. */
  onRegistrationRequired?: () => void;
}

export function usePresenceVerification({ service, pollIntervalMs = 15000, onStatusChange, onSessionExpired, onRegistrationRequired }: Options) {
  const camera = useCamera();
  // The camera object is new on every render; these three are stable, so they are safe in dependency lists.
  const { start: startCamera, stop: stopCamera, capture: captureFrame } = camera;
  const [phase, setPhase] = useState<Phase>({ name: "hidden" });
  const [check, setCheck] = useState<CurrentCheck | null>(null);
  const [connectionProblem, setConnectionProblem] = useState(false);
  const [skewMs, setSkewMs] = useState(0);

  // Latest values for async callbacks (avoids stale closures and effect re-subscription).
  const phaseRef = useRef<Phase>(phase);
  const checkRef = useRef<CurrentCheck | null>(null);
  const registeredRef = useRef(false);
  const callbacks = useRef({ onStatusChange, onSessionExpired, onRegistrationRequired });
  callbacks.current = { onStatusChange, onSessionExpired, onRegistrationRequired };

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const applyStatus = useCallback(
    (s: VerificationStatus) => {
      if (s.serverTime) setSkewMs(Date.parse(s.serverTime) - Date.now());
      setConnectionProblem(false);
      callbacks.current.onStatusChange?.(s);

      const current = phaseRef.current;
      if (current.name === "verifying") return; // the verify call decides what happens next

      const due = s.verificationRequired ? s.current : null;
      if (due) {
        checkRef.current = due;
        setCheck(due);
        if (current.name === "hidden") go({ name: "intro" });
        return;
      }
      if (OPEN_PHASES.has(current.name)) {
        stopCamera();
        checkRef.current = null;
        setCheck(null);
        // Session over, or someone else already verified: close quietly. Otherwise the window ran out.
        const quiet = !s.verificationActive || s.sessionVerificationStatus === "VERIFIED";
        go(quiet ? { name: "hidden" } : { name: "result", outcome: "expired", nextCheckDueAt: s.nextCheckDueAt });
      }
    },
    [stopCamera, go],
  );

  const refresh = useCallback(async () => {
    try {
      applyStatus(await service.getStatus());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) callbacks.current.onSessionExpired?.();
      else setConnectionProblem(true);
    }
  }, [service, applyStatus]);

  // Poll the backend. The backend, not this browser, decides when a check is due.
  useEffect(() => {
    const controller = new AbortController();
    const tick = async () => {
      try {
        const s = await service.getStatus(controller.signal);
        if (!controller.signal.aborted) applyStatus(s);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) callbacks.current.onSessionExpired?.();
        else setConnectionProblem(true);
      }
    };
    void tick();
    const id = setInterval(tick, pollIntervalMs);
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [service, pollIntervalMs, applyStatus]);

  // Success message closes itself.
  useEffect(() => {
    if (phase.name !== "result" || phase.outcome !== "verified") return;
    const id = setTimeout(() => go({ name: "hidden" }), 4000);
    return () => clearTimeout(id);
  }, [phase, go]);

  const beginCamera = useCallback(async () => {
    go({ name: "starting" });
    const error = await startCamera();
    if (phaseRef.current.name !== "starting") {
      stopCamera(); // popup was closed while waiting
      return;
    }
    go(error ? { name: "cameraError", kind: error } : { name: "ready" });
  }, [startCamera, stopCamera, go]);

  /** "Verify Presence" / "Try Again": makes sure a face is registered, then opens the camera. */
  const startVerification = useCallback(async () => {
    if (!registeredRef.current) {
      go({ name: "starting" });
      try {
        const { registered } = await service.getRegistration();
        if (!registered) {
          go({ name: "notRegistered" });
          callbacks.current.onRegistrationRequired?.();
          return;
        }
        registeredRef.current = true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return callbacks.current.onSessionExpired?.();
        return go({ name: "unavailable", message: "Could not reach the server. Check your connection and try again." });
      }
    }
    await beginCamera();
  }, [service, beginCamera, go]);

  const finish = useCallback(
    (result: VerifyResult) => {
      if (result.reason === "NOT_REGISTERED") {
        registeredRef.current = false;
        go({ name: "notRegistered" });
        callbacks.current.onRegistrationRequired?.();
      } else if (result.reason === "SERVICE_ERROR") {
        go({ name: "unavailable", message: "Verification is temporarily unavailable. This attempt was not counted. Please try again." });
      } else if (result.status === "VERIFIED") {
        go({ name: "result", outcome: "verified", nextCheckDueAt: result.nextCheckDueAt });
      } else if (result.closed) {
        go({ name: "result", outcome: "unverified", nextCheckDueAt: result.nextCheckDueAt });
      } else {
        go({ name: "retry", reason: result.reason ?? "NO_MATCH", attemptsRemaining: result.attemptsRemaining });
      }
      void refresh();
    },
    [go, refresh],
  );

  const fail = useCallback(
    (err: unknown) => {
      const code = err instanceof ApiError ? err.code : "";
      if (err instanceof ApiError && err.status === 401) {
        go({ name: "hidden" });
        callbacks.current.onSessionExpired?.();
      } else if (code === "VERIFICATION_EXPIRED") {
        go({ name: "result", outcome: "expired", nextCheckDueAt: null });
        void refresh();
      } else if (code === "VERIFICATION_CLOSED" || code === "VERIFICATION_NOT_FOUND") {
        go({ name: "hidden" });
        void refresh();
      } else if (code === "NETWORK_ERROR") {
        go({ name: "unavailable", message: "Network problem. Check your connection and try again." });
      } else if (code === "INVALID_FRAME" || code === "FRAME_TOO_LARGE") {
        go({ name: "unavailable", message: "The camera image could not be read. Please try again." });
      } else if (code === "VERIFICATION_IN_PROGRESS") {
        go({ name: "unavailable", message: "A verification is already in progress. Wait a moment and try again." });
      } else {
        go({ name: "unavailable", message: "Something went wrong. Please try again." });
      }
    },
    [go, refresh],
  );

  /** "Verify Now": captures one frame, turns the camera off, sends the frame. */
  const submit = useCallback(async () => {
    // Synchronous guard: a double click can never send two frames.
    if (phaseRef.current.name !== "ready" || !checkRef.current) return;
    go({ name: "verifying" });
    let frame: Blob;
    try {
      frame = await captureFrame();
    } catch {
      stopCamera();
      return go({ name: "unavailable", message: "Could not capture the camera image. Please try again." });
    }
    stopCamera(); // camera light goes off before we wait for the answer
    try {
      finish(await service.verify(checkRef.current.verificationId, frame));
    } catch (err) {
      fail(err);
    }
  }, [captureFrame, stopCamera, service, finish, fail, go]);

  /** "Cancel" / Escape / backdrop. While a check is open this only minimises: the check stays due. */
  const dismiss = useCallback(() => {
    const p = phaseRef.current;
    if (p.name === "verifying") return; // let the answer arrive
    stopCamera();
    if (p.name === "result") return go({ name: "hidden" });
    if (p.name === "hidden" || p.name === "banner") return;
    go({ name: "banner" });
  }, [stopCamera, go]);

  const reopen = useCallback(() => go({ name: "intro" }), [go]);

  return { phase, check, camera, connectionProblem, skewMs, startVerification, submit, dismiss, reopen, refresh };
}
