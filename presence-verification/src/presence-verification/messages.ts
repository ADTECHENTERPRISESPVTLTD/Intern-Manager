/** All user-facing wording in one place. Titles/messages follow the task documents. */
import type { CameraErrorKind, FailureReason, RegistrationRejection } from "./types";

export interface Copy {
  title: string;
  message: string;
}

export const REASON_COPY: Record<FailureReason | RegistrationRejection, Copy> = {
  NO_FACE: { title: "No Face Detected", message: "Please position your face inside the camera frame." },
  MULTIPLE_FACES: {
    title: "Multiple Faces Detected",
    message: "Only the registered intern should be visible during verification.",
  },
  LOW_QUALITY: {
    title: "Image Not Clear Enough",
    message: "Make sure lighting is sufficient and your face is clearly visible.",
  },
  NO_MATCH: { title: "Verification Failed", message: "We could not verify your presence." },
  NOT_REGISTERED: { title: "Face Registration Required", message: "Register your face before presence checks can begin." },
  SERVICE_ERROR: {
    title: "Verification Unavailable",
    message: "Verification is temporarily unavailable. This attempt was not counted. Please try again.",
  },
  INCONSISTENT_FRAMES: {
    title: "Photos Don't Match",
    message: "All registration photos must show the same person. Please start again.",
  },
};

export const CAMERA_ERROR_COPY: Record<CameraErrorKind, Copy> = {
  PERMISSION_DENIED: {
    title: "Camera Access Required",
    message:
      "Please allow camera access to complete your presence verification. Use the camera icon in your browser's address bar, then try again.",
  },
  NO_CAMERA: { title: "No Camera Found", message: "Connect a camera to this device, then try again." },
  IN_USE: {
    title: "Camera Unavailable",
    message: "Your camera may be in use by another app. Close it and try again.",
  },
  UNSUPPORTED: {
    title: "Camera Not Supported",
    message: "This browser cannot open the camera here. Use an up-to-date browser on a secure (https) connection.",
  },
  UNKNOWN: { title: "Camera Error", message: "We could not start your camera. Please try again." },
};

export const PRIVACY_NOTICE =
  "Your camera is used only for this check and turns off right after. One photo is sent for matching and is not saved. Presence checks run only during your official work session.";

export const GUIDANCE = [
  "Keep your face inside the frame.",
  "Make sure lighting is sufficient.",
  "Only one person should be visible.",
  "Avoid excessive movement.",
];
