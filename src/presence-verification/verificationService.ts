/**
 * The only place that talks to the backend. Components receive a `VerificationService`
 * and never call fetch themselves, so the real backend can replace the mock without UI changes.
 */
import type { CurrentCheck, VerificationStatus, VerifyResult } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly frameIndex?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface VerificationService {
  getStatus(signal?: AbortSignal): Promise<VerificationStatus>;
  requestCheck(): Promise<CurrentCheck>;
  verify(verificationId: string, frame: Blob): Promise<VerifyResult>;
  getRegistration(): Promise<{ registered: boolean }>;
  register(frames: Blob[]): Promise<void>;
}

export interface ServiceOptions {
  /** e.g. "https://api.example.com/api/v1" */
  baseUrl: string;
  /** Called on every request, so a refreshed token is always used. */
  getToken: () => string | null;
  timeoutMs?: number;
}

export function createVerificationService({ baseUrl, getToken, timeoutMs = 15000 }: ServiceOptions): VerificationService {
  async function request<T>(method: string, path: string, body?: FormData, signal?: AbortSignal): Promise<T> {
    const token = getToken();
    const timeout = AbortSignal.timeout(timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (err) {
      if (signal?.aborted) throw err; // the caller cancelled: not a network problem
      throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server");
    }

    let json: { success?: boolean; data?: T; message?: string; code?: string; frameIndex?: number } | null = null;
    try {
      json = await res.json();
    } catch {
      /* fall through: non-JSON body */
    }
    if (!res.ok || !json?.success) {
      throw new ApiError(res.status, json?.code ?? "UNKNOWN_ERROR", json?.message ?? "Request failed", json?.frameIndex);
    }
    return json.data as T;
  }

  return {
    getStatus: (signal) => request<VerificationStatus>("GET", "/verifications/status", undefined, signal),
    requestCheck: () => request<CurrentCheck>("POST", "/verifications/request"),
    verify(verificationId, frame) {
      const form = new FormData();
      form.append("verificationId", verificationId);
      form.append("frame", frame, "frame.jpg");
      return request<VerifyResult>("POST", "/verifications/verify", form);
    },
    getRegistration: () => request<{ registered: boolean }>("GET", "/verifications/registration"),
    async register(frames) {
      const form = new FormData();
      frames.forEach((f, i) => form.append("frames", f, `frame${i}.jpg`));
      await request<{ registered: boolean }>("POST", "/verifications/registration", form);
    },
  };
}
