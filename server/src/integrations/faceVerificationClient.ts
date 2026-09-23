/**
 * Talks to the face-verification service (Flask / Python AI microservice).
 * Integration layer between Node/Express backend and Python face service.
 */

/** What the face service says about one camera frame. */
export type FaceDecision = "MATCH" | "NO_MATCH" | "NO_FACE" | "MULTIPLE_FACES" | "LOW_QUALITY";

/** Why a registration photo was refused. */
export type RegistrationRejection = "NO_FACE" | "MULTIPLE_FACES" | "LOW_QUALITY" | "INCONSISTENT_FRAMES";

/** The face service is down, too slow, or rejected our API key. The intern is NOT at fault: do not use up an attempt. */
export class FaceServiceUnavailableError extends Error {}

/** The uploaded frame was not a readable JPEG. Tell the browser 400 INVALID_FRAME; do not use up an attempt. */
export class FaceServiceRejectedFrameError extends Error {}

/** A registration photo was refused. Answer the browser with 422 and `reason` as the error code. */
export class FaceRegistrationRejectedError extends Error {
  reason: RegistrationRejection;
  frameIndex: number | null;
  constructor(reason: RegistrationRejection, frameIndex: number | null) {
    super(reason);
    this.reason = reason;
    this.frameIndex = frameIndex;
  }
}

export interface FaceVerificationClient {
  /** Compare one JPEG frame with a stored template. `confidence` is null unless a face was actually compared. */
  verify(frame: Uint8Array, template: string): Promise<{ decision: FaceDecision; confidence: number | null }>;
  /** Turn 3 to 5 JPEG photos into an encrypted template. Store the returned string (never send it to the browser). */
  register(frames: Uint8Array[]): Promise<string>;
}

export interface ClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export function createFaceVerificationClient(options: ClientOptions): FaceVerificationClient {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? 5000;

  async function post(path: string, form: FormData): Promise<{ status: number; body: any }> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "X-API-Key": options.apiKey },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new FaceServiceUnavailableError("face service unreachable or timed out");
    }
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* a non-JSON answer is treated as a failure below */
    }
    return { status: res.status, body };
  }

  const jpeg = (bytes: Uint8Array) => new Blob([bytes as any], { type: "image/jpeg" });

  return {
    async verify(frame, template) {
      const form = new FormData();
      form.append("frame", jpeg(frame), "frame.jpg");
      form.append("template", template);
      const { status, body } = await post("/v1/verify", form);
      if (status === 200 && typeof body?.decision === "string") {
        return { decision: body.decision as FaceDecision, confidence: body.confidence ?? null };
      }
      if (status === 400 && body?.error === "INVALID_IMAGE") {
        throw new FaceServiceRejectedFrameError("frame is not a readable JPEG");
      }
      throw new FaceServiceUnavailableError(`face service answered ${status}`);
    },

    async register(frames) {
      const form = new FormData();
      frames.forEach((f, i) => form.append("frames", jpeg(f), `frame${i}.jpg`));
      const { status, body } = await post("/v1/register", form);
      if (status === 200 && typeof body?.template === "string") return body.template;
      if (status === 422 && typeof body?.error === "string") {
        throw new FaceRegistrationRejectedError(body.error as RegistrationRejection, body.frameIndex ?? null);
      }
      if (status === 400 && body?.error === "INVALID_IMAGE") {
        throw new FaceServiceRejectedFrameError("a registration photo is not a readable JPEG");
      }
      throw new FaceServiceUnavailableError(`face service answered ${status}`);
    },
  };
}

/** How a face decision becomes a verification result to store and return */
export function toCheckOutcome(decision: FaceDecision): {
  status: "VERIFIED" | "FAILED";
  reason: null | "NO_MATCH" | "NO_FACE" | "MULTIPLE_FACES" | "LOW_QUALITY";
} {
  return decision === "MATCH" ? { status: "VERIFIED", reason: null } : { status: "FAILED", reason: decision };
}
