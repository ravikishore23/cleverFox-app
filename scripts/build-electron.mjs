import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve("electron/dist");
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: ["electron/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: ["node20"],
  outfile: path.join(outDir, "main.js"),
  external: ["electron"],
  sourcemap: true,
});

await build({
  entryPoints: ["electron/preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: ["node20"],
  outfile: path.join(outDir, "preload.cjs"),
  external: ["electron"],
  sourcemap: true,
});
