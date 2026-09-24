import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraErrorKind } from "./types";

/** Frames are downscaled and re-encoded so they stay under the backend's 300 KB limit. */
export const MAX_FRAME_WIDTH = 640;
export const MAX_FRAME_BYTES = 280 * 1024;

export type CameraState = { status: "idle" | "starting" | "live" } | { status: "error"; error: CameraErrorKind };

export function mapCameraError(err: unknown): CameraErrorKind {
  const name = (err as { name?: string } | null)?.name;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "PERMISSION_DENIED";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "NO_CAMERA";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "IN_USE";
    default:
      return "UNKNOWN";
  }
}

/**
 * Owns the webcam. Guarantees the stream is released on stop(), on unmount, and when the
 * permission prompt is answered after the popup was already closed.
 */
export function useCamera() {
  const [state, setState] = useState<CameraState>({ status: "idle" });
  const [ready, setReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attempt = useRef(0); // bumped on every start/stop so stale async results can be discarded

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const bind = (el: HTMLVideoElement, stream: MediaStream) => {
    el.srcObject = stream;
    const playing = el.play?.();
    playing?.catch?.(() => {}); // autoplay is already requested; a rejected play() is harmless
  };

  /** Callback ref: attaches the live stream whenever the <video> element (re)mounts. */
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) bind(el, streamRef.current);
  }, []);

  const start = useCallback(async (): Promise<CameraErrorKind | null> => {
    release();
    const id = ++attempt.current;
    setReady(false);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState({ status: "error", error: "UNSUPPORTED" });
      return "UNSUPPORTED";
    }
    setState({ status: "starting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (id !== attempt.current) {
        // Closed (or restarted) while the browser was asking for permission: don't leave the camera on.
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      streamRef.current = stream;
      if (videoRef.current) bind(videoRef.current, stream);
      setState({ status: "live" });
      return null;
    } catch (err) {
      if (id !== attempt.current) return null;
      const kind = mapCameraError(err);
      setState({ status: "error", error: kind });
      return kind;
    }
  }, [release]);

  const stop = useCallback(() => {
    attempt.current++;
    release();
    setReady(false);
    setState((s) => (s.status === "idle" ? s : { status: "idle" }));
  }, [release]);

  useEffect(
    () => () => {
      attempt.current++;
      release();
    },
    [release],
  );

  /** Grabs one still frame, downscaled JPEG. It lives in memory only and is never stored. */
  const capture = useCallback(async (): Promise<Blob> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) throw new Error("CAMERA_NOT_READY");
    const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CAPTURE_FAILED");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_FRAME_BYTES) return blob;
    }
    throw new Error("CAPTURE_FAILED");
  }, []);

  return {
    state,
    ready,
    attachVideo,
    onVideoReady: useCallback(() => setReady(true), []),
    start,
    stop,
    capture,
  };
}
