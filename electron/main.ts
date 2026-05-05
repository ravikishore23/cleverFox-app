import { app, BrowserWindow, ipcMain, dialog, shell, session } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;

// In dev, use OS-managed paths to avoid lock/permission issues in workspace files.
if (isDev) {
  const devUserData = path.join(app.getPath("appData"), "CleverFox-Dev");
  const devSessionData = path.join(
    app.getPath("temp"),
    "CleverFox-Dev-Session",
  );
  app.setPath("userData", devUserData);
  app.setPath("sessionData", devSessionData);
  app.commandLine.appendSwitch(
    "disk-cache-dir",
    path.join(app.getPath("temp"), "CleverFox-Dev-Cache"),
  );
  app.commandLine.appendSwitch("disable-http-cache");
}

// Disable GPU shader disk cache to avoid platform-specific GPU cache issues
// when running inside development environments.
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

let mainWindow: BrowserWindow | null = null;

function setupContentSecurityPolicy() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const devConnect = isDev
      ? " http://localhost:5173 ws://localhost:5173 http://127.0.0.1:5173 ws://127.0.0.1:5173 http://192.168.0.5:5173 ws://192.168.0.5:5173"
      : "";
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self'";
    const csp = [
      "default-src 'self'",
      `connect-src 'self' http://localhost:3001 ws://localhost:3001 http://127.0.0.1:3001 ws://127.0.0.1:3001 http://192.168.0.5:3001 ws://192.168.0.5:3001${devConnect}`,
      "img-src 'self' data: blob: http: https:",
      "media-src 'self' data: blob: http: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; ");

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });
}

function setupPermissions() {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      if (permission === "media") {
        callback(true);
      } else {
        callback(false);
      }
    },
  );

  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => {
      // @ts-ignore
      if (permission === "camera" || permission === "media") {
        return true;
      }
      return false;
    },
  );

  session.defaultSession.setDevicePermissionHandler((details) => {
    // @ts-ignore
    if (details.deviceType === "camera" || details.deviceType === "audio") {
      return true;
    }
    return false;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    show: false,
    backgroundColor: "#0f0f0f",
    title: "Clever Fox – Study Room",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    // DEV: Vite dev server
    const devUrl = process.env.CLEVERFOX_VITE_URL ?? "http://localhost:5173";
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // PROD: Vite build output
    mainWindow.loadFile(
      path.join(__dirname, "../../client/dist-react/index.html"),
    );
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupContentSecurityPolicy();
  setupPermissions();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("app:ping", async () => "pong");

ipcMain.handle("ai-request", async (_event, prompt: string) => {
  try {
    // @ts-ignore
    const { AgentController } =
      // @ts-ignore
      await import("../backend/dist/agent/AgentController.js").catch(() => {
        // Fallback for dev where it's not compiled
        // @ts-ignore
        return import("../backend/src/agent/AgentController.ts" as any);
      });
    const agent = new AgentController();
    const result = await agent.processPrompt(prompt);
    return { ok: true, result };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("fs:pickDirectory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle(
  "fs:mkdirp",
  async (
    _event,
    dirPath: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
);

ipcMain.handle(
  "fs:readTextFile",
  async (
    _event,
    filePath: string,
  ): Promise<{ ok: true; data: string } | { ok: false; error: string }> => {
    try {
      const data = await fs.readFile(filePath, "utf8");
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
);

ipcMain.handle(
  "fs:writeTextFile",
  async (
    _event,
    filePath: string,
    content: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf8");
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
);

ipcMain.handle(
  "shell:openPath",
  async (
    _event,
    targetPath: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const result = await shell.openPath(targetPath);
      if (result) return { ok: false, error: result };
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
);

ipcMain.handle(
  "shell:openExternal",
  async (
    _event,
    url: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      // basic allowlist
      if (!/^https?:\/\//i.test(url))
        return { ok: false, error: "Only http(s) URLs are allowed" };
      await shell.openExternal(url);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
);

ipcMain.handle(
  "proc:run",
  async (
    _event,
    command: string,
    args: string[] = [],
    options?: { cwd?: string; timeoutMs?: number },
  ): Promise<
    | { ok: true; code: number | null; stdout: string; stderr: string }
    | { ok: false; error: string }
  > => {
    try {
      const child = spawn(command, args, {
        cwd: options?.cwd,
        windowsHide: true,
        shell: false,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      const timeoutMs = options?.timeoutMs ?? 30_000;
      const timeout = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore
        }
      }, timeoutMs);

      const code: number | null = await new Promise((resolve, reject) => {
        child.on("error", reject);
        child.on("close", resolve);
      });

      clearTimeout(timeout);
      return { ok: true, code, stdout, stderr };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
);
