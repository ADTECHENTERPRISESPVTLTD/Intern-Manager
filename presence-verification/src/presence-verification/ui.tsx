import { useEffect, useRef, useState, type ReactNode } from "react";
import type { useCamera } from "./useCamera";

export type Tone = "success" | "warning" | "unverified" | "error" | "neutral";

/** Colour dot + text. Colour is never the only signal: the label always says what it means. */
export function StatusHeading({ tone, id, children }: { tone: Tone; id?: string; children: ReactNode }) {
  return (
    <h2 className="pv-title" id={id} tabIndex={-1}>
      <span className={`pv-dot pv-dot--${tone}`} aria-hidden="true" />
      {children}
    </h2>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="pv-spinner" role="img" aria-label={label}>
      <span className="pv-spinner__ring" />
    </span>
  );
}

/** mm:ss until the check expires. Display only: the backend decides when it really expires. */
export function Countdown({ expiresAtMs, skewMs, onZero }: { expiresAtMs: number; skewMs: number; onZero?: () => void }) {
  const remaining = () => Math.max(0, Math.ceil((expiresAtMs - (Date.now() + skewMs)) / 1000));
  const [secs, setSecs] = useState(remaining);
  const fired = useRef(false);
  const onZeroRef = useRef(onZero);
  onZeroRef.current = onZero;

  useEffect(() => {
    fired.current = false;
    setSecs(remaining());
    const id = setInterval(() => {
      const r = remaining();
      setSecs(r);
      if (r === 0 && !fired.current) {
        fired.current = true;
        onZeroRef.current?.(); // ask the backend what really happened
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAtMs, skewMs]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <span className="pv-countdown">
      Time left to verify: <time>{`${mm}:${ss}`}</time>
    </span>
  );
}

/** Live preview with an oval guide. The <video> is only ever fed by useCamera. */
export function CameraStage({ camera, starting }: { camera: ReturnType<typeof useCamera>; starting: boolean }) {
  return (
    <div className="pv-stage">
      <video
        ref={camera.attachVideo}
        onLoadedData={camera.onVideoReady}
        className="pv-video"
        autoPlay
        playsInline
        muted
        aria-label="Live camera preview"
      />
      <svg className="pv-guide" viewBox="0 0 100 75" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <ellipse cx="50" cy="37" rx="19" ry="26" />
      </svg>
      {(starting || !camera.ready) && (
        <div className="pv-stage__overlay">
          <Spinner label="Starting camera" />
          <span>Starting camera…</span>
        </div>
      )}
    </div>
  );
}
