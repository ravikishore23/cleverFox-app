import { spawn } from "node:child_process";
import http from "node:http";

const VITE_URL = process.env.CLEVERFOX_VITE_URL ?? "http://localhost:5173";
const API_URL = process.env.CLEVERFOX_API_URL ?? "http://localhost:3001/health";

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

async function isViteDevServer(url) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          if (body.length < 16_384) body += chunk;
        });
        res.on("end", () => {
          const looksLikeVite =
            /@vite\/client/i.test(body) || /vite/i.test(String(res.headers.server || ""));
          resolve(Boolean(looksLikeVite));
        });
      });
      req.on("error", () => resolve(false));
      req.setTimeout(750, () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

let viteChild = null;
let apiChild = null;

function shutdown(code = 0) {
  if (viteChild && !viteChild.killed) {
    try {
      viteChild.kill();
    } catch {
      // ignore
    }
  }
  if (apiChild && !apiChild.killed) {
    try {
      apiChild.kill();
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const viteUp = await isServerUp(VITE_URL);
const viteIsCorrect = viteUp ? await isViteDevServer(VITE_URL) : false;
const apiUp = await isServerUp(API_URL);

if (!viteUp || !viteIsCorrect) {
  // Start Vite only if it's not already running.
  // Use dev:reset to kill stale dev servers + bind host.
  viteChild = spawnNpmRun("dev:reset", {
    env: { ...process.env },
  });
}

if (!apiUp) {
  apiChild = spawnNpmRun("dev:api", {
    env: { ...process.env },
  });
}

// Wait for Vite before launching Electron.
let retries = 0;
while (!(await isServerUp(VITE_URL))) {
  await new Promise((r) => setTimeout(r, 250));
  retries += 1;
  if (retries > 120) {
    console.error(`[dev-electron] Vite did not start at ${VITE_URL}`);
    shutdown(1);
  }
}

retries = 0;
while (!(await isServerUp(API_URL))) {
  await new Promise((r) => setTimeout(r, 250));
  retries += 1;
  if (retries > 120) {
    console.error(`[dev-electron] API did not start at ${API_URL}`);
    shutdown(1);
  }
}

const electronChild = spawnNpmRun("electron:dev", {
  env: { ...process.env, CLEVERFOX_VITE_URL: VITE_URL },
});

electronChild.on("exit", (code) => {
  shutdown(code ?? 0);
});
