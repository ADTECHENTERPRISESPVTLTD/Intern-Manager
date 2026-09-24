import { useCallback, useRef, useState } from "react";
import { CAMERA_ERROR_COPY, PRIVACY_NOTICE, REASON_COPY } from "./messages";
import type { RegistrationRejection } from "./types";
import { useCamera } from "./useCamera";
import { CameraStage, Spinner, StatusHeading } from "./ui";
import { ApiError, type VerificationService } from "./verificationService";
import "./presence-verification.css";

// The contract (ai-service/README.md, docs/verification-contract.md) supports 3-5 frames;
// using the full 5 gives the averaged template more angle/lighting variation to match
// against later, which is exactly what real-world verification needs to be reliable.
const PHOTOS = 5;
const REJECTIONS = new Set<string>(["NO_FACE", "MULTIPLE_FACES", "LOW_QUALITY", "INCONSISTENT_FRAMES"]);
const PROMPTS = [
  "Look straight at the camera.",
  "Turn your head slightly to the left.",
  "Turn your head slightly to the right.",
  "Tilt your head slightly up.",
  "Tilt your head slightly down.",
];

type Step =
  | { name: "intro" }
  | { name: "capturing"; taken: number }
  | { name: "uploading" }
  | { name: "done" }
  | { name: "rejected"; title: string; message: string }
  | { name: "cameraError"; title: string; message: string };

export interface FaceRegistrationProps {
  service: VerificationService;
  onRegistered?: () => void;
}

/** One-time onboarding step: 5 photos, uploaded together. The photos live in memory only. */
export function FaceRegistration({ service, onRegistered }: FaceRegistrationProps) {
  const camera = useCamera();
  const { start: startCamera, stop: stopCamera, capture } = camera;
  const [step, setStep] = useState<Step>({ name: "intro" });
  const frames = useRef<Blob[]>([]);
  const busy = useRef(false);

  const begin = useCallback(async () => {
    frames.current = [];
    setStep({ name: "capturing", taken: 0 });
    const error = await startCamera();
    if (error) {
      const copy = CAMERA_ERROR_COPY[error];
      setStep({ name: "cameraError", ...copy });
    }
  }, [startCamera]);

  const upload = useCallback(async () => {
    setStep({ name: "uploading" });
    try {
      await service.register(frames.current);
      setStep({ name: "done" });
      onRegistered?.();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      // Only genuine photo rejections get specific wording; anything else (server down, etc.) is a generic registration error.
      if (REJECTIONS.has(code as RegistrationRejection)) {
        const copy = REASON_COPY[code as RegistrationRejection];
        const which = err instanceof ApiError && err.frameIndex !== undefined ? ` (photo ${err.frameIndex + 1})` : "";
        setStep({ name: "rejected", title: copy.title, message: `${copy.message}${which}` });
      } else {
        setStep({ name: "rejected", title: "Registration Unavailable", message: "We could not complete registration. Please try again." });
      }
    } finally {
      frames.current = []; // never keep the photos around
    }
  }, [service, onRegistered]);

  const takePhoto = useCallback(async () => {
    if (busy.current || step.name !== "capturing") return; // ignore double clicks
    busy.current = true;
    try {
      frames.current.push(await capture());
      const taken = frames.current.length;
      if (taken >= PHOTOS) {
        stopCamera();
        await upload();
      } else {
        setStep({ name: "capturing", taken });
      }
    } catch {
      stopCamera();
      setStep({ name: "rejected", title: "Camera Error", message: "We could not capture a photo. Please try again." });
    } finally {
      busy.current = false;
    }
  }, [capture, stopCamera, upload, step.name]);

  return (
    <section className="pv-card" aria-labelledby="pvr-title">
      {step.name === "intro" && (
        <>
          <h2 className="pv-title" id="pvr-title">
            Register Your Face
          </h2>
          <p className="pv-text">We take {PHOTOS} quick photos once, so we can confirm it is you during presence checks.</p>
          <p className="pv-privacy">{PRIVACY_NOTICE} Only a numeric face template is stored, never your photos.</p>
          <div className="pv-actions">
            <button type="button" className="pv-btn pv-btn--primary" onClick={() => void begin()}>
              Start Camera
            </button>
          </div>
        </>
      )}

      {step.name === "capturing" && (
        <>
          <h2 className="pv-title" id="pvr-title">
            Photo {step.taken + 1} of {PHOTOS}
          </h2>
          <p className="pv-text">{PROMPTS[step.taken]}</p>
          <CameraStage camera={camera} starting={false} />
          <div className="pv-actions">
            <button type="button" className="pv-btn pv-btn--primary" disabled={!camera.ready} onClick={() => void takePhoto()}>
              Capture Photo
            </button>
            <button
              type="button"
              className="pv-btn pv-btn--ghost"
              onClick={() => {
                stopCamera();
                frames.current = [];
                setStep({ name: "intro" });
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {step.name === "uploading" && (
        <div className="pv-center" role="status">
          <h2 className="pv-title" id="pvr-title">
            Registering…
          </h2>
          <Spinner label="Registering" />
        </div>
      )}

      {step.name === "done" && (
        <div role="status">
          <StatusHeading tone="success" id="pvr-title">
            Face Registered
          </StatusHeading>
          <p className="pv-text">You're all set. Presence checks will use this registration.</p>
        </div>
      )}

      {(step.name === "rejected" || step.name === "cameraError") && (
        <>
          <StatusHeading tone="unverified" id="pvr-title">
            {step.title}
          </StatusHeading>
          <p className="pv-text">{step.message}</p>
          <div className="pv-actions">
            <button type="button" className="pv-btn pv-btn--primary" onClick={() => void begin()}>
              Try Again
            </button>
          </div>
        </>
      )}
    </section>
  );
}
