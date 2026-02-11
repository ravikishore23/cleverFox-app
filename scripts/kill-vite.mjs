import { execFileSync, execSync } from "node:child_process";

function killPid(pid) {
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

function killViteWindows() {
  const projectRoot = process.cwd();
  const needle = `${projectRoot}\node_modules\vite\bin\vite.js`;

  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*${needle.replace(/\\/g, "\\\\")}*' }
if (-not $procs) { '[]' } else { ($procs | Select-Object -ExpandProperty ProcessId) | ConvertTo-Json -Compress }
`.trim();

  let raw = "[]";
  try {
    raw = execFileSync("powershell", ["-NoProfile", "-Command", ps], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    }).trim();
  } catch {
    return { killed: 0, pids: [] };
  }

  if (!raw) return { killed: 0, pids: [] };

  const parsed = JSON.parse(raw);
  const pids = (Array.isArray(parsed) ? parsed : [parsed])
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));

  let killed = 0;
  for (const pid of pids) {
    if (killPid(pid)) killed += 1;
  }

  return { killed, pids };
}

function killVitePosix() {
  const needle = `${process.cwd()}/node_modules/vite/bin/vite.js`;
  const out = execSync("ps -ax -o pid=,command=", {
    stdio: ["ignore", "pipe", "ignore"],
  }).toString();

  const pids = out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.includes(needle))
    .map((line) => Number(line.split(/\s+/)[0]))
    .filter((n) => Number.isFinite(n));

  let killed = 0;
  for (const pid of pids) {
    if (killPid(pid)) killed += 1;
  }

  return { killed, pids };
}

const result =
  process.platform === "win32" ? killViteWindows() : killVitePosix();

if (result.killed > 0) {
  console.log(
    `[kill-vite] stopped ${result.killed} dev server(s): ${result.pids.join(", ")}`,
  );
} else {
  console.log("[kill-vite] no dev servers to stop");
}
