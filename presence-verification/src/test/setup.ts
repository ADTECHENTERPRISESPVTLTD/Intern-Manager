import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom is not a "secure context" by default; the camera code checks for one.
Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });

// jsdom does not implement media playback or canvas; give the components what they need.
Object.defineProperty(HTMLMediaElement.prototype, "play", { value: () => Promise.resolve(), configurable: true });
Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { get: () => 640, configurable: true });
Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { get: () => 480, configurable: true });
HTMLCanvasElement.prototype.getContext = (() => ({ drawImage: () => {} })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
  cb(new Blob(["fake-jpeg"], { type: "image/jpeg" }));
};
