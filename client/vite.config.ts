import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";
// https://vite.dev/config/
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tsconfigPaths()],
  base: "./",
  build: {
    outDir: "dist-react",
  },
  server: {
    host: true, // This allows the server to be accessed from other devices on the LAN
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true,
      }
    }
  },
});
