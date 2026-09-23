import { useEffect, useRef, type KeyboardEvent } from "react";
import { CAMERA_ERROR_COPY, GUIDANCE, PRIVACY_NOTICE, REASON_COPY } from "./messages";
import { CameraStage, Countdown, Spinner, StatusHeading } from "./ui";
import { isModalPhase, usePresenceVerification, type Options, type Phase } from "./usePresenceVerification";
import "./presence-verification.css";

export interface PresenceVerificationProps extends Options {
  /** Show a slim warning when the backend cannot be reached. Default true. */
  showConnectionWarning?: boolean;
}

/**
 * Mount once inside the authenticated intern layout.
 * It polls the backend, shows the "verification required" notification, and runs the camera popup.
 * It never decides that someone is verified: it only displays what the backend answers.
 */
export function PresenceVerification({ showConnectionWarning = true, ...options }: PresenceVerificationProps) {
  const v = usePresenceVerification(options);
  const { phase, check, camera, skewMs } = v;
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const modalOpen = isModalPhase(phase);
  const expiresAtMs = check ? Date.parse(check.expiresAt) : 0;

  // Move focus into the popup when it opens and on each step; give it back when it closes.
  useEffect(() => {
    if (!modalOpen) return;
    if (!returnFocus.current) returnFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [modalOpen, phase.name]);
  useEffect(() => {
    if (modalOpen) return;
    returnFocus.current?.focus?.();
    returnFocus.current = null;
  }, [modalOpen]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return v.dismiss();
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']")];
    if (!focusable.length) return e.preventDefault();
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
    else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
  };

  return (
    <>
      {showConnectionWarning && v.connectionProblem && (
        <div className="pv-conn" role="status">
          Can't reach the server. Presence checks may be delayed. Retrying…
        </div>
      )}

      {phase.name === "banner" && check && (
        <div className="pv-banner" role="alert">
          <div>
            <strong>Presence Verification Required</strong>
            <p>Your 30-minute presence check is now required.</p>
            <Countdown expiresAtMs={expiresAtMs} skewMs={skewMs} onZero={v.refresh} />
          </div>
          <button type="button" className="pv-btn pv-btn--primary" onClick={v.reopen}>
            Verify Presence
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="pv-overlay" onMouseDown={(e) => e.target === e.currentTarget && v.dismiss()}>
          <div
            ref={panelRef}
            className="pv-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pv-title"
            aria-busy={phase.name === "verifying"}
            onKeyDown={onKeyDown}
          >
            <Body phase={phase} v={v} expiresAtMs={expiresAtMs} camera={camera} />
          </div>
        </div>
      )}
    </>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="pv-actions">{children}</div>;
}

function Body({ phase, v, expiresAtMs, camera }: { phase: Phase; v: ReturnType<typeof usePresenceVerification>; expiresAtMs: number; camera: ReturnType<typeof usePresenceVerification>["camera"] }) {
  const cancel = (
    <button type="button" className="pv-btn pv-btn--ghost" onClick={v.dismiss}>
      Cancel
    </button>
  );
  const timer = v.check ? <Countdown expiresAtMs={expiresAtMs} skewMs={v.skewMs} onZero={v.refresh} /> : null;
  const tryAgain = (
    <button type="button" className="pv-btn pv-btn--primary" onClick={() => void v.startVerification()}>
      Try Again
    </button>
  );

  switch (phase.name) {
    case "intro":
      return (
        <>
          <StatusHeading tone="warning" id="pv-title">
            Presence Verification Required
          </StatusHeading>
          <p className="pv-text">Please verify your presence to continue your official work session.</p>
          {timer}
          <p className="pv-privacy">{PRIVACY_NOTICE}</p>
          <Actions>
            <button type="button" className="pv-btn pv-btn--primary" onClick={() => void v.startVerification()}>
              Verify Presence
            </button>
            {cancel}
          </Actions>
        </>
      );

    case "starting":
    case "ready":
      return (
        <>
          <h2 className="pv-title" id="pv-title" tabIndex={-1}>
            Verify Your Presence
          </h2>
          <p className="pv-text">Position your face inside the frame.</p>
          <CameraStage camera={camera} starting={phase.name === "starting"} />
          <ul className="pv-guidance">
            {GUIDANCE.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          {timer}
          <Actions>
            <button type="button" className="pv-btn pv-btn--primary" disabled={phase.name !== "ready" || !camera.ready} onClick={() => void v.submit()}>
              Verify Now
            </button>
            {cancel}
          </Actions>
          <p className="pv-footnote">Verification required for your official work session.</p>
        </>
      );

    case "verifying":
      return (
        <div className="pv-center" role="status">
          <h2 className="pv-title" id="pv-title" tabIndex={-1}>
            Verifying…
          </h2>
          <Spinner label="Verifying" />
          <p className="pv-text">This only takes a few seconds. Your camera is already off.</p>
        </div>
      );

    case "retry": {
      const copy = REASON_COPY[phase.reason];
      return (
        <>
          <StatusHeading tone={phase.reason === "NO_MATCH" ? "error" : "unverified"} id="pv-title">
            {copy.title}
          </StatusHeading>
          <p className="pv-text">{copy.message}</p>
          <p className="pv-note">
            {phase.attemptsRemaining} {phase.attemptsRemaining === 1 ? "attempt" : "attempts"} remaining.
          </p>
          {timer}
          <Actions>
            {tryAgain}
            {cancel}
          </Actions>
        </>
      );
    }

    case "cameraError": {
      const copy = CAMERA_ERROR_COPY[phase.kind];
      return (
        <>
          <StatusHeading tone="unverified" id="pv-title">
            {copy.title}
          </StatusHeading>
          <p className="pv-text">{copy.message}</p>
          <p className="pv-note">This does not count as a failed attempt.</p>
          {timer}
          <Actions>
            {tryAgain}
            {cancel}
          </Actions>
        </>
      );
    }

    case "unavailable":
      return (
        <>
          <StatusHeading tone="warning" id="pv-title">
            Verification Unavailable
          </StatusHeading>
          <p className="pv-text">{phase.message}</p>
          {timer}
          <Actions>
            {tryAgain}
            {cancel}
          </Actions>
        </>
      );

    case "notRegistered":
      return (
        <>
          <StatusHeading tone="warning" id="pv-title">
            {REASON_COPY.NOT_REGISTERED.title}
          </StatusHeading>
          <p className="pv-text">{REASON_COPY.NOT_REGISTERED.message}</p>
          <Actions>
            <button type="button" className="pv-btn pv-btn--primary" onClick={v.dismiss}>
              OK
            </button>
          </Actions>
        </>
      );

    case "result":
      return <Result phase={phase} skewMs={v.skewMs} onClose={v.dismiss} />;

    default:
      return null;
  }
}

function Result({ phase, skewMs, onClose }: { phase: Extract<Phase, { name: "result" }>; skewMs: number; onClose: () => void }) {
  if (phase.outcome === "verified") {
    const minutes = phase.nextCheckDueAt ? Math.max(1, Math.round((Date.parse(phase.nextCheckDueAt) - (Date.now() + skewMs)) / 60000)) : null;
    return (
      <div role="status">
        <StatusHeading tone="success" id="pv-title">
          Presence Verified
        </StatusHeading>
        <p className="pv-text">Your presence has been successfully verified.</p>
        {minutes !== null && <p className="pv-note">Next verification: approximately {minutes} {minutes === 1 ? "minute" : "minutes"}</p>}
        <Actions>
          <button type="button" className="pv-btn pv-btn--primary" onClick={onClose}>
            Done
          </button>
        </Actions>
      </div>
    );
  }
  const expired = phase.outcome === "expired";
  return (
    <div role="status">
      <StatusHeading tone="unverified" id="pv-title">
        Presence Unverified
      </StatusHeading>
      <p className="pv-text">
        {expired
          ? "The verification window ended before your presence was confirmed."
          : "We could not verify your presence. Your session has been marked as unverified."}
      </p>
      <p className="pv-note">Your next presence check will follow as scheduled.</p>
      <Actions>
        <button type="button" className="pv-btn pv-btn--primary" onClick={onClose}>
          Close
        </button>
      </Actions>
    </div>
  );
}
