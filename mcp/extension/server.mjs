#!/usr/bin/env node
/*
 * Claude Desktop extension entry point.
 *
 * Claude Desktop is an MSIX (Microsoft Store) package on Windows and runs its
 * extension hosts sandboxed, where stderr does not reliably reach the app log.
 * So everything here is also written to a file next to Claude's own logs:
 *
 *   %APPDATA%\Claude\logs\follow-ups-launcher.log
 *
 * The real server is TypeScript in the project (it needs lib/domain and the
 * generated Prisma client), so this launcher starts it and passes stdin/stdout
 * through untouched, keeping the MCP protocol byte-for-byte intact.
 *
 * PROJECT_DIR is baked in at pack time by scripts/pack-extension.mjs.
 */

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_DIR = process.env.FOLLOW_UPS_PROJECT_DIR ?? "__PROJECT_DIR__";

const LOG_DIR =
  process.platform === "win32" && process.env.APPDATA
    ? path.join(process.env.APPDATA, "Claude", "logs")
    : os.tmpdir();
const LOG_FILE = path.join(LOG_DIR, "follow-ups-launcher.log");

function log(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  // stderr in case the host does capture it...
  try {
    process.stderr.write(`[follow-ups] ${line}`);
  } catch {}
  // ...and a file, because under MSIX it usually does not.
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, line, "utf8");
  } catch {}
}

process.on("uncaughtException", (error) => {
  log(`UNCAUGHT: ${error?.stack ?? error}`);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  log(`UNHANDLED REJECTION: ${error?.stack ?? error}`);
});

log("=== launcher start ===");
log(`host node=${process.versions.node} execPath=${process.execPath}`);
log(`cwd=${process.cwd()}`);
log(`PROJECT_DIR=${PROJECT_DIR} exists=${existsSync(PROJECT_DIR)}`);

/** The Node that installed node_modules — not necessarily the one running us. */
function resolveSystemNode() {
  const candidates = [
    process.env.FOLLOW_UPS_NODE,
    process.platform === "win32" ? "C:\\Program Files\\nodejs\\node.exe" : null,
    process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA ?? "", "Programs", "nodejs", "node.exe")
      : null,
    "/usr/local/bin/node",
    "/usr/bin/node",
    "/opt/homebrew/bin/node",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const found = existsSync(candidate);
    log(`node candidate ${candidate} exists=${found}`);
    if (found) return candidate;
  }

  log("no system node found; falling back to host node");
  return process.execPath;
}

const tsxCli = path.join(PROJECT_DIR, "node_modules", "tsx", "dist", "cli.mjs");
const tsconfig = path.join(PROJECT_DIR, "mcp", "tsconfig.json");
const entry = path.join(PROJECT_DIR, "mcp", "server.ts");
// The database is now Supabase Postgres; credentials come from .env.local,
// which the server loads itself via lib/load-env.
const envFile = path.join(PROJECT_DIR, ".env.local");

let missing = false;
for (const [label, file] of [
  ["tsx", tsxCli],
  ["tsconfig", tsconfig],
  ["server", entry],
  ["credentials (.env.local)", envFile],
]) {
  const found = existsSync(file);
  log(`${label}: ${file} exists=${found}`);
  if (!found) missing = true;
}
if (missing) {
  log("ABORT: required files unreachable (path moved, npm install missing, or sandbox denied access)");
  process.exit(1);
}

const nodeBin = resolveSystemNode();
log(`spawning: ${nodeBin} ${tsxCli} --tsconfig ${tsconfig} ${entry}`);

let child;
try {
  child = spawn(nodeBin, [tsxCli, "--tsconfig", tsconfig, entry], {
    cwd: PROJECT_DIR,
    // stdin/stdout carry the MCP protocol untouched; stderr is captured so
    // startup errors land in the log file above.
    stdio: ["inherit", "inherit", "pipe"],
    // No DATABASE_URL here: the server reads .env.local itself, so the
    // credentials live in exactly one place.
    env: { ...process.env },
  });
} catch (error) {
  log(`SPAWN THREW: ${error?.stack ?? error}`);
  process.exit(1);
}

log(`spawned pid=${child.pid}`);

child.stderr.on("data", (chunk) => log(`child stderr: ${chunk.toString().trimEnd()}`));
child.on("error", (error) => {
  log(`CHILD ERROR: ${error?.stack ?? error}`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  log(`child exited code=${code} signal=${signal}`);
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
