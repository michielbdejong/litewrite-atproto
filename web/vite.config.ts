import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, Vite serves the SPA on :5173 and proxies the BFF paths to the
// Express server on :3000, so the browser sees a single origin (matching
// production, where Express serves the built SPA directly).
const bffPaths = [
  "/api",
  "/login",
  "/oauth",
  "/client-metadata.json",
  "/jwks.json",
];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      bffPaths.map((path) => [path, { target: "http://127.0.0.1:3000", changeOrigin: true }]),
    ),
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
