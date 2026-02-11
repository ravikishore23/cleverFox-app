import { spawn } from "node:child_process";
import http from "node:http";

const VITE_URL = process.env.CLEVERFOX_VITE_URL ?? "http://localhost:5173";

function spawnNpmRun(scriptName, options = {}) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", `npm run ${scriptName}`], {
      stdio: "inherit",
      shell: false,
      windowsHide: false,
      ...options,
    });
  }

  return spawn("npm", ["run", scriptName], {
    stdio: "inherit",
    shell: false,
    ...options,
  });
}

async function isServerUp(url) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(
          res.statusCode != null &&
            res.statusCode >= 200 &&
            res.statusCode < 500,
        );
      });
      req.on("error", () => resolve(false));
      req.setTimeout(500, () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

let viteChild = null;

function shutdown(code = 0) {
  if (viteChild && !viteChild.killed) {
    try {
      viteChild.kill();
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const viteUp = await isServerUp(VITE_URL);

if (!viteUp) {
  // Start Vite only if it's not already running.
  viteChild = spawnNpmRun("dev", {
    env: { ...process.env },
  });
}

// Always run electron:dev (it will wait-on Vite URL).
const electronChild = spawnNpmRun("electron:dev", {
  env: { ...process.env, CLEVERFOX_VITE_URL: VITE_URL },
});

electronChild.on("exit", (code) => {
  shutdown(code ?? 0);
});
