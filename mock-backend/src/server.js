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

app.listen(config.port, "127.0.0.1", () => {
  console.log(`MOCK backend on http://127.0.0.1:${config.port}  (face service: ${config.aiUrl})`);
  console.log("This is a throwaway mock. It is NOT the real Intern-Manager backend.");
});
