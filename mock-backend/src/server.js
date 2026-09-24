import { readFileSync } from "node:fs";
import https from "node:https";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createAiClient } from "./aiClient.js";
import { createApp } from "./app.js";
import { createClock, loadConfig } from "./config.js";

const config = loadConfig();
if (!config.aiKey) console.warn("FACE_VERIFICATION_KEY is not set: calls to the face service will be rejected.");

const app = createApp({
  config,
  ai: createAiClient({ url: config.aiUrl, key: config.aiKey, timeoutMs: config.aiTimeoutMs }),
  clock: createClock(),
});

// Set HTTPS=1 to test the camera from another device (a real phone) on the same network.
// The browser blocks the camera on any plain http:// address except localhost, and also
// blocks a page loaded over https:// from calling a plain http:// API ("mixed content") -
// so once the frontend uses https://, this needs to as well. The certificate is local and
// self-signed (scripts/generate-local-cert.sh), never leaves this network, and is git-ignored.
const useHttps = process.env.HTTPS === "1";
const scheme = useHttps ? "https" : "http";

function startHttps() {
  const certsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".certs-local");
  try {
    const key = readFileSync(path.join(certsDir, "key.pem"));
    const cert = readFileSync(path.join(certsDir, "cert.pem"));
    https.createServer({ key, cert }, app).listen(config.port, config.host, onListening);
  } catch {
    console.error(`No certificate found in ${certsDir}. Run: scripts/generate-local-cert.sh`);
    process.exit(1);
  }
}

function onListening() {
  console.log(`MOCK backend on ${scheme}://${config.host}:${config.port}  (face service: ${config.aiUrl})`);
  console.log("This is a throwaway mock. It is NOT the real Intern-Manager backend.");
}

if (useHttps) startHttps();
else app.listen(config.port, config.host, onListening);
