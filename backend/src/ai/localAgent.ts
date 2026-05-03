import fs from "fs/promises";
import path from "path";
import { spawn, exec } from "child_process";
import { EventEmitter } from "events";
import crypto from "crypto";
import { appendFile } from "fs/promises";

/* ---- Exported Analysis Types ---- */

export type FolderItem = {
  name: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  children?: FolderItem[];
};

export type FolderAnalysis = {
  path: string;
  exists: boolean;
  items: FolderItem[];
  projectType: string | null;
  totalFiles: number;
  totalDirs: number;
  summary: string;
};

const WORKSPACE_ROOT = path.resolve(
  process.cwd(),
  "backend",
  "agent_workspace",
);
const LOG_DIR = path.resolve(process.cwd(), "backend", "logs");
const AGENT_LOG = path.join(LOG_DIR, "agent.log");

// Commands allowed for agent execution
const ALLOWED_COMMANDS = new Set([
  // Shell basics
  "echo", "dir", "ls", "type", "cat", "mkdir",
  // Editors & apps
  "notepad", "code", "code-insiders", "pycharm64", "pycharm", "explorer", "start",
  // Node.js ecosystem
  "node", "npm", "npx", "tsx", "tsc", "bun", "deno",
  // Python
  "python", "python3", "pip", "pip3",
  // Java
  "javac", "java",
  // C / C++
  "gcc", "g++",
  // Go / Rust / Ruby / PHP / .NET
  "go", "cargo", "rustc", "ruby", "php", "dotnet",
  // Git
  "git",
  // Package managers
  "yarn", "pnpm",
  // Windows specific
  "where", "powershell", "cmd",
]);

const MAX_EXECUTIONS_PER_SESSION = 50;

export type AgentRunOptions = {
  timeoutMs?: number;
  cwd?: string;
};

export class LocalAgent {
  private emitters = new Map<string, EventEmitter>();
  private executionCount = 0;

  constructor() {
    fs.mkdir(WORKSPACE_ROOT, { recursive: true }).catch(() => {});
    fs.mkdir(LOG_DIR, { recursive: true }).catch(() => {});
  }

  /**
   * Resolve a path. If `allowAbsolute` is true, absolute paths are permitted
   * (for writing to user directories like Obsidian vaults).
   * Otherwise paths are sandboxed to WORKSPACE_ROOT.
   */
  private resolvePath(filePath: string, allowAbsolute = false): string {
    if (allowAbsolute && path.isAbsolute(filePath)) {
      return path.normalize(filePath);
    }
    const resolved = path.resolve(WORKSPACE_ROOT, filePath || "");
    if (!resolved.startsWith(WORKSPACE_ROOT)) {
      throw new Error("Path escape detected");
    }
    return resolved;
  }

  // Sanitize arguments
  private validateArgs(args: string[]) {
    for (const arg of args) {
      if (
        arg.includes("..") ||
        arg.includes(";") ||
        arg.includes("&") ||
        arg.includes("|") ||
        arg.includes(">")
      ) {
        throw new Error("Invalid argument detected");
      }
    }
  }

  private async log(message: string) {
    await appendFile(
      AGENT_LOG,
      `${new Date().toISOString()} ${message}\n`,
    ).catch(() => {});
  }

  private newId() {
    return crypto.randomBytes(12).toString("hex");
  }

  /* ---- File System Tools (used by agentic loop) ---- */

  async listDir(dir = "", allowAbsolute = false): Promise<{ name: string; isDirectory: boolean }[]> {
    const p = this.resolvePath(dir, allowAbsolute);
    const items = await fs.readdir(p, { withFileTypes: true });
    return items.map((d) => ({
      name: d.name,
      isDirectory: d.isDirectory(),
    }));
  }

  async readFile(filePath: string, allowAbsolute = false): Promise<string> {
    const p = this.resolvePath(filePath, allowAbsolute);
    return fs.readFile(p, "utf8");
  }

  async writeFile(filePath: string, content: string, allowAbsolute = false): Promise<void> {
    const p = this.resolvePath(filePath, allowAbsolute);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, "utf8");
    await this.log(`WRITE ${p}`);
  }

  async createDirectory(dirPath: string): Promise<void> {
    const p = path.isAbsolute(dirPath) ? path.normalize(dirPath) : this.resolvePath(dirPath);
    await fs.mkdir(p, { recursive: true });
    await this.log(`MKDIR ${p}`);
  }

  async openApp(targetPath: string): Promise<string> {
    await this.log(`OPEN ${targetPath}`);
    // Use Windows 'start' or platform-appropriate opener
    const proc = spawn("cmd", ["/c", "start", "", targetPath], {
      shell: false,
      windowsHide: true,
      detached: true,
      stdio: "ignore",
    });
    proc.unref();
    return `Opened: ${targetPath}`;
  }

  /* ---- Browser Search (opens browser with search URL) ---- */

  private static BROWSER_MAP: Record<string, string> = {
    chrome: "chrome",
    brave: "brave",
    edge: "msedge",
    firefox: "firefox",
    "google chrome": "chrome",
    "microsoft edge": "msedge",
  };

  async browserSearch(query: string, browserName = "brave"): Promise<string> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const browserExe = LocalAgent.BROWSER_MAP[browserName.toLowerCase()] || browserName;

    await this.log(`BROWSER_SEARCH query="${query}" browser=${browserExe} url=${searchUrl}`);

    // Use exec with a full command string so the URL is properly passed
    // spawn + start has issues passing URLs as separate args on Windows
    exec(`start "" "${browserExe}" "${searchUrl}"`, (err) => {
      if (err) this.log(`BROWSER_SEARCH_ERROR: ${err.message}`);
    });

    return `🔍 Opened ${browserName} and searched for: "${query}"`;
  }

  /* ---- Command Execution (legacy, kept for compatibility) ---- */

  runCommand(command: string, args: string[] = [], opts: AgentRunOptions = {}) {
    if (!ALLOWED_COMMANDS.has(command)) {
      const msg = `DENIED command: ${command}`;
      this.log(msg);
      throw new Error(msg);
    }

    if (this.executionCount >= MAX_EXECUTIONS_PER_SESSION) {
      throw new Error("Execution limit reached");
    }

    this.validateArgs(args);
    this.executionCount++;

    const id = this.newId();
    const emitter = new EventEmitter();
    this.emitters.set(id, emitter);

    const child = spawn(command, args, {
      cwd: opts.cwd || WORKSPACE_ROOT,
      env: process.env,
      shell: true,
    });

    this.log(`RUN ${command} ${args.join(" ")} (id=${id})`);

    child.stdout.on("data", (b) => emitter.emit("stdout", b.toString()));
    child.stderr.on("data", (b) => emitter.emit("stderr", b.toString()));

    const timeout = opts.timeoutMs ?? 20_000;
    const killTimer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
        emitter.emit("stderr", "Process killed due to timeout");
      } catch {}
    }, timeout);

    child.on("error", (err) => {
      clearTimeout(killTimer);
      emitter.emit("error", err.message);
      emitter.emit("exit", { code: 1, signal: null });
    });

    child.on("close", (code, signal) => {
      clearTimeout(killTimer);
      emitter.emit("exit", { code, signal });
      setTimeout(() => {
        this.emitters.delete(id);
      }, 30_000);
    });

    return { id, emitter };
  }

  /* ---- Folder Analysis (scans directories before code generation) ---- */

  async analyzeFolder(dir: string, maxDepth = 2): Promise<FolderAnalysis> {
    const absDir = path.isAbsolute(dir) ? path.normalize(dir) : path.resolve(WORKSPACE_ROOT, dir);

    try {
      await fs.access(absDir);
    } catch {
      return {
        path: absDir,
        exists: false,
        items: [],
        projectType: null,
        totalFiles: 0,
        totalDirs: 0,
        summary: `Directory "${absDir}" does not exist. It will be created.`,
      };
    }

    const items = await this.listRecursiveScan(absDir, maxDepth);
    const counts = this.countItems(items);
    const projectType = this.detectProjectType(items);

    return {
      path: absDir,
      exists: true,
      items,
      projectType,
      totalFiles: counts.files,
      totalDirs: counts.dirs,
      summary: this.buildAnalysisSummary(absDir, counts.files, counts.dirs, projectType),
    };
  }

  private async listRecursiveScan(
    dir: string,
    maxDepth: number,
    depth = 0,
  ): Promise<FolderItem[]> {
    if (depth >= maxDepth) return [];

    const SKIP_DIRS = new Set([
      "node_modules", ".git", "__pycache__", ".venv", "venv",
      ".next", "dist", "build", ".cache", "coverage", ".idea",
    ]);

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const results: FolderItem[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) {
            results.push({ name: entry.name, isDirectory: true, children: [] });
            continue;
          }
          const children = await this.listRecursiveScan(
            path.join(dir, entry.name),
            maxDepth,
            depth + 1,
          );
          results.push({ name: entry.name, isDirectory: true, children });
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          let size: number | undefined;
          try {
            const stat = await fs.stat(path.join(dir, entry.name));
            size = stat.size;
          } catch {}
          results.push({ name: entry.name, isDirectory: false, size, extension: ext });
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  private countItems(items: FolderItem[]): { files: number; dirs: number } {
    let files = 0;
    let dirs = 0;
    for (const item of items) {
      if (item.isDirectory) {
        dirs++;
        if (item.children) {
          const sub = this.countItems(item.children);
          files += sub.files;
          dirs += sub.dirs;
        }
      } else {
        files++;
      }
    }
    return { files, dirs };
  }

  private detectProjectType(items: FolderItem[]): string | null {
    const names = new Set(items.map((i) => i.name.toLowerCase()));
    if (names.has("package.json")) return "Node.js";
    if (names.has("requirements.txt") || names.has("setup.py") || names.has("pyproject.toml")) return "Python";
    if (names.has("cargo.toml")) return "Rust";
    if (names.has("go.mod")) return "Go";
    if (names.has("pom.xml") || names.has("build.gradle")) return "Java";
    if (names.has("gemfile")) return "Ruby";
    if (names.has("composer.json")) return "PHP";
    if ([...names].some((n) => n.endsWith(".csproj") || n.endsWith(".sln"))) return ".NET";
    return null;
  }

  private buildAnalysisSummary(
    dir: string,
    files: number,
    dirs: number,
    projectType: string | null,
  ): string {
    let summary = `Scanned "${path.basename(dir)}": ${files} file${files !== 1 ? "s" : ""}, ${dirs} folder${dirs !== 1 ? "s" : ""}`;
    if (projectType) summary += ` | Detected: ${projectType} project`;
    if (files === 0 && dirs === 0) summary += ` | Empty directory — ready for new files`;
    return summary;
  }

  getEmitter(id: string) {
    return this.emitters.get(id);
  }

  resetSession() {
    this.executionCount = 0;
  }
}

export const agent = new LocalAgent();
