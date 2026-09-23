/** Talks to ai-service (Python). The browser never calls it; only this backend does. */

export class AiUnavailable extends Error {}
export class AiRejectedFrame extends Error {}
export class AiRegistrationRejected extends Error {
  constructor(reason, frameIndex) {
    super(reason);
    this.reason = reason;
    this.frameIndex = frameIndex;
  }
}

export function createAiClient({ url, key, timeoutMs }) {
  async function call(path, form) {
    let res;
    try {
      res = await fetch(`${url}${path}`, {
        method: "POST",
        headers: { "X-API-Key": key },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new AiUnavailable("face service unreachable or timed out");
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON body is treated as a service failure below */
    }
    return { status: res.status, body };
  }

  const blob = (buf) => new Blob([buf], { type: "image/jpeg" });

  return {
    /** -> { decision, confidence } */
    async verify(frame, template) {
      const form = new FormData();
      form.append("frame", blob(frame), "frame.jpg");
      form.append("template", template);
      const { status, body } = await call("/v1/verify", form);
      if (status === 200 && body?.decision) return { decision: body.decision, confidence: body.confidence ?? null };
      if (status === 400 && body?.error === "INVALID_IMAGE") throw new AiRejectedFrame("frame is not a readable image");
      throw new AiUnavailable(`face service returned ${status}`);
    },

    /** -> template string, or throws AiRegistrationRejected / AiUnavailable */
    async register(frames) {
      const form = new FormData();
      frames.forEach((f, i) => form.append("frames", blob(f), `frame${i}.jpg`));
      const { status, body } = await call("/v1/register", form);
      if (status === 200 && body?.template) return body.template;
      if (status === 422 && body?.error) throw new AiRegistrationRejected(body.error, body.frameIndex ?? null);
      if (status === 400 && body?.error === "INVALID_IMAGE") throw new AiRejectedFrame("a frame is not a readable image");
      throw new AiUnavailable(`face service returned ${status}`);
    },
  };
}
