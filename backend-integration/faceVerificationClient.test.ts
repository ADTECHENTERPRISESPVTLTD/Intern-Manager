import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  FaceRegistrationRejectedError,
  FaceServiceRejectedFrameError,
  FaceServiceUnavailableError,
  createFaceVerificationClient,
  toCheckOutcome,
} from "./faceVerificationClient.ts";

// A stand-in for the face service, so these tests need neither Python nor a camera.
type Reply = { status: number; body?: unknown; delayMs?: number; raw?: string };
let reply: Reply;
let lastHeaders: http.IncomingHttpHeaders;
let lastPath = "";
let lastBody = "";
let server: http.Server;
let baseUrl: string;

before(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      lastHeaders = req.headers;
      lastPath = req.url ?? "";
      lastBody = Buffer.concat(chunks).toString("latin1");
      if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
      res.writeHead(reply.status, { "Content-Type": "application/json" });
      res.end(reply.raw ?? JSON.stringify(reply.body ?? {}));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => server.close());
beforeEach(() => {
  reply = { status: 200, body: {} };
});

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const client = () => createFaceVerificationClient({ baseUrl, apiKey: "secret-key", timeoutMs: 400 });

describe("verify", () => {
  test("returns the decision and confidence", async () => {
    reply = { status: 200, body: { decision: "MATCH", confidence: 0.81 } };
    assert.deepEqual(await client().verify(JPEG, "tpl"), { decision: "MATCH", confidence: 0.81 });
  });

  test("sends the API key, the frame and the template to /v1/verify", async () => {
    reply = { status: 200, body: { decision: "NO_MATCH", confidence: 0.1 } };
    await client().verify(JPEG, "my-template");
    assert.equal(lastPath, "/v1/verify");
    assert.equal(lastHeaders["x-api-key"], "secret-key");
    assert.match(lastBody, /name="frame"/);
    assert.match(lastBody, /name="template"/);
    assert.match(lastBody, /my-template/);
  });

  test("a null confidence stays null (no face compared)", async () => {
    reply = { status: 200, body: { decision: "NO_FACE", confidence: null } };
    assert.deepEqual(await client().verify(JPEG, "tpl"), { decision: "NO_FACE", confidence: null });
  });

  test("an unreadable frame is reported separately from a broken service", async () => {
    reply = { status: 400, body: { error: "INVALID_IMAGE" } };
    await assert.rejects(client().verify(JPEG, "tpl"), FaceServiceRejectedFrameError);
  });

  for (const [status, why] of [[401, "wrong API key"], [429, "rate limited"], [500, "crash"], [503, "down"], [400, "bad template"]] as const) {
    test(`${status} (${why}) is treated as 'service unavailable', never as the intern's fault`, async () => {
      reply = { status, body: { error: "X" } };
      await assert.rejects(client().verify(JPEG, "tpl"), FaceServiceUnavailableError);
    });
  }

  test("a slow service times out as 'unavailable'", async () => {
    reply = { status: 200, body: { decision: "MATCH" }, delayMs: 1500 };
    await assert.rejects(client().verify(JPEG, "tpl"), FaceServiceUnavailableError);
  });

  test("a service that is not running is 'unavailable'", async () => {
    const dead = createFaceVerificationClient({ baseUrl: "http://127.0.0.1:1", apiKey: "k", timeoutMs: 400 });
    await assert.rejects(dead.verify(JPEG, "tpl"), FaceServiceUnavailableError);
  });

  test("an answer that is not JSON is 'unavailable'", async () => {
    reply = { status: 200, raw: "<html>oops</html>" };
    await assert.rejects(client().verify(JPEG, "tpl"), FaceServiceUnavailableError);
  });
});

describe("register", () => {
  test("returns the template string", async () => {
    reply = { status: 200, body: { template: "encrypted-blob" } };
    assert.equal(await client().register([JPEG, JPEG, JPEG]), "encrypted-blob");
    assert.equal(lastPath, "/v1/register");
    assert.equal((lastBody.match(/name="frames"/g) ?? []).length, 3);
  });

  test("a refused photo carries the reason and which photo it was", async () => {
    reply = { status: 422, body: { error: "MULTIPLE_FACES", frameIndex: 1 } };
    await assert.rejects(client().register([JPEG, JPEG, JPEG]), (err: unknown) => {
      assert.ok(err instanceof FaceRegistrationRejectedError);
      assert.equal(err.reason, "MULTIPLE_FACES");
      assert.equal(err.frameIndex, 1);
      return true;
    });
  });

  test("an unreadable photo and a broken service are told apart", async () => {
    reply = { status: 400, body: { error: "INVALID_IMAGE" } };
    await assert.rejects(client().register([JPEG, JPEG, JPEG]), FaceServiceRejectedFrameError);
    reply = { status: 503, body: {} };
    await assert.rejects(client().register([JPEG, JPEG, JPEG]), FaceServiceUnavailableError);
  });
});

describe("toCheckOutcome", () => {
  test("MATCH is VERIFIED with no reason", () => {
    assert.deepEqual(toCheckOutcome("MATCH"), { status: "VERIFIED", reason: null });
  });
  for (const d of ["NO_MATCH", "NO_FACE", "MULTIPLE_FACES", "LOW_QUALITY"] as const) {
    test(`${d} is FAILED with the same reason`, () => {
      assert.deepEqual(toCheckOutcome(d), { status: "FAILED", reason: d });
    });
  }
});
