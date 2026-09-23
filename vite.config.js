import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Set VITE_HTTPS=1 to test the camera from another device (e.g. a real phone) on the same
// network. The camera only works over https:// or localhost - a plain http://LAN-IP address
// is always blocked by the browser, so a local, self-signed certificate is generated here for
// that case. It never leaves this network; there is nothing to trust beyond "yes, it's me".
const useHttps = process.env.VITE_HTTPS === "1";

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: { port: 5173, host: true, https: useHttps }
});