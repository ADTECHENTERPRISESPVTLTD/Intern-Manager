import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // host: true also binds 0.0.0.0, so the dev server is reachable from other devices on the
  // same network (e.g. testing on a real phone) - not just this machine.
  server: { port: 5173, host: true }
});