import { execFileSync } from "node:child_process";

function usage() {
  console.log("Usage: node scripts/kill-port.mjs <port> [--force]");
  process.exit(1);
}

const portArg = process.argv[2];
if (!portArg) usage();

const port = Number(portArg);
if (!Number.isFinite(port) || port <= 0) usage();

const force = process.argv.includes("--force");

if (process.platform !== "win32") {
  console.log("[kill-port] supported on Windows only");
  process.exit(0);
}

function psEscapeSingleQuotes(value) {
  return String(value).replace(/'/g, "''");
}

const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$conns = Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue
if (-not $conns) { Write-Output '[kill-port] port ${port} is free'; exit 0 }

$pids = $conns | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
foreach ($pid in $pids) {
  if (-not $pid) { continue }
  $proc = Get-CimInstance Win32_Process -Filter \"ProcessId=$pid\" | Select-Object -First 1
  $cmd = ''
  if ($proc -and $proc.CommandLine) { $cmd = $proc.CommandLine }
  $looksLikeDev = ($cmd -match 'vite\\.js') -or ($cmd -match 'node_modules\\\\vite') -or ($cmd -match 'vite --config')
  if (-not ${force ? "$true" : "$false"} -and -not $looksLikeDev) {
    Write-Output ('[kill-port] port ${port} is used by PID ' + $pid)
    Write-Output ('[kill-port] not killing (command line does not look like Vite). Use --force to kill anyway.')
    if ($cmd) { Write-Output ('[kill-port] cmd: ' + $cmd) }
    continue
  }
  Write-Output ('[kill-port] killing PID ' + $pid + ' on port ${port}')
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 250
$conn2 = Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $conn2) { Write-Output '[kill-port] port ${port} is now free' } else { Write-Output '[kill-port] port ${port} still busy' }
`;

try {
  const out = execFileSync("powershell", ["-NoProfile", "-Command", ps], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  process.stdout.write(out);
} catch (error) {
  const stderr = error?.stderr?.toString?.() ?? "";
  const stdout = error?.stdout?.toString?.() ?? "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  process.exit(1);
}
