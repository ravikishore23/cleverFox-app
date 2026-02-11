import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

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
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // PROD: Vite build output
    mainWindow.loadFile(path.join(__dirname, "../../dist-react/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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
