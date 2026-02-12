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
});
