import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createVerificationService } from "./verificationService";

const service = createVerificationService({ baseUrl: "http://api.test/api/v1", getToken: () => "tok-123" });

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("verificationService", () => {
  it("sends the bearer token and unwraps the { success, data } envelope", async () => {
    const fetchMock = respond(200, { success: true, data: { registered: true }, message: "OK" });
    await expect(service.getRegistration()).resolves.toEqual({ registered: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/api/v1/verifications/registration");
    expect(init.headers).toEqual({ Authorization: "Bearer tok-123" });
  });

  it("verify posts the id and the frame as multipart form data", async () => {
    const fetchMock = respond(200, { success: true, data: { status: "VERIFIED" }, message: "" });
    await service.verify("v-9", new Blob(["x"], { type: "image/jpeg" }));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/api/v1/verifications/verify");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form.get("verificationId")).toBe("v-9");
    expect(form.get("frame")).toBeInstanceOf(Blob);
  });

  it("register posts every photo under 'frames'", async () => {
    const fetchMock = respond(200, { success: true, data: { registered: true }, message: "" });
    await service.register([new Blob(["a"]), new Blob(["b"]), new Blob(["c"])]);
    expect((fetchMock.mock.calls[0]![1].body as FormData).getAll("frames")).toHaveLength(3);
  });

  it("turns an error envelope into an ApiError with the backend's code", async () => {
    respond(409, { success: false, message: "No presence check is due", code: "VERIFICATION_NOT_DUE" });
    await expect(service.requestCheck()).rejects.toMatchObject({ name: "ApiError", status: 409, code: "VERIFICATION_NOT_DUE" });
  });

  it("keeps the rejected photo number from a 422", async () => {
    respond(422, { success: false, message: "rejected", code: "MULTIPLE_FACES", frameIndex: 1 });
    await expect(service.register([])).rejects.toMatchObject({ code: "MULTIPLE_FACES", frameIndex: 1 });
  });

  it("reports an unreachable server as NETWORK_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(service.getStatus()).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("treats a non-JSON error page as an ApiError, not a crash", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })));
    await expect(service.getStatus()).rejects.toBeInstanceOf(ApiError);
  });

  it("lets a caller cancel without that being reported as a network problem", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))))));
    const pending = service.getStatus(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
