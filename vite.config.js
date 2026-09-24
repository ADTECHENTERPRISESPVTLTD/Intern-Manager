import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Set VITE_HTTPS=1 to test the camera from another device (e.g. a real phone) on the same
// network. The camera only works over https:// or localhost - a plain http://LAN-IP address
// is always blocked by the browser, so a local, self-signed certificate is generated here for
// that case. It never leaves this network; there is nothing to trust beyond "yes, it's me".
const useHttps = process.env.VITE_HTTPS === "1";
// The mock-backend is proxied through this same origin (below) instead of the browser calling
// it directly on its own host:port. A browser trusts a self-signed certificate per exact
// origin, so calling the backend directly meant trusting it *again*, separately from the
// frontend, on every device/browser profile (this is exactly what broke on the phone, then
// again on the laptop). Proxied, the browser only ever talks to this one origin; Node proxies
// the request to the backend server-side, where there's no browser trust prompt to fail.
const backendTarget = process.env.MOCK_BACKEND_TARGET || `http${useHttps ? "s" : ""}://127.0.0.1:4000`;

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    port: 5173,
    host: true,
    https: useHttps,
    proxy: {
      "/api": { target: backendTarget, changeOrigin: true, secure: false },
    },
  },
});