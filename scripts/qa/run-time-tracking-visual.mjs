#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

const envCandidates = [
  path.join(rootDir, ".env.visual.test"),
  path.join(rootDir, ".env.test"),
  path.join(rootDir, ".env"),
];
const playwrightCli = path.join(rootDir, "node_modules", "playwright", "cli.js");
const reportCandidates = [
  path.join(rootDir, "test-results", "playwright-report", "index.html"),
  path.join(rootDir, "playwright-report", "index.html"),
];

function canReachUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const target = new URL(url);
      const client = target.protocol === "https:" ? https : http;
      const req = client.request(
        {
          method: "GET",
          hostname: target.hostname,
          port: target.port || (target.protocol === "https:" ? 443 : 80),
          path: target.pathname || "/",
          timeout: timeoutMs,
        },
        (res) => {
          res.resume();
          resolve(true);
        }
      );

      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

let envFileUsed = null;
let loadedEnv = {};

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    loadedEnv = parseEnvFile(candidate);
    envFileUsed = path.basename(candidate);
    break;
  }
}

const mergedEnv = {
  ...process.env,
  ...loadedEnv,
};

if (!envFileUsed) {
  console.warn("No .env.visual.test/.env.test/.env file found. Using current process env only.");
}

if (!mergedEnv.TIME_VISUAL_BASE_URL) {
  mergedEnv.TIME_VISUAL_BASE_URL = "http://localhost:5000";
}

console.log(`Using TIME_VISUAL_BASE_URL=${mergedEnv.TIME_VISUAL_BASE_URL}`);
if (envFileUsed) {
  console.log(`Loaded test env from ${envFileUsed}`);
}

if (!fs.existsSync(playwrightCli)) {
  console.error("Playwright CLI not found in node_modules. Run npm install first.");
  process.exit(1);
}

const reachable = await canReachUrl(mergedEnv.TIME_VISUAL_BASE_URL);
if (!reachable) {
  console.error(`Cannot reach ${mergedEnv.TIME_VISUAL_BASE_URL}. Start the app first with: node start-local.js dev`);
  process.exit(1);
}

const runResult = spawnSync(
  process.execPath,
  [playwrightCli, "test", "tests/visual/time-tracking.visual.spec.ts", "--reporter=html"],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: mergedEnv,
  }
);

if (runResult.error) {
  console.error(`Failed to run Playwright tests: ${runResult.error.message}`);
  process.exit(1);
}

if (runResult.status !== 0) {
  process.exit(runResult.status ?? 1);
}

const reportIndexPath = reportCandidates.find((candidate) => fs.existsSync(candidate));

if (!reportIndexPath) {
  console.log("Visual tests passed. HTML report was not found, skipping auto-open.");
  process.exit(0);
}

let openCommand;
let openArgs;

if (process.platform === "win32") {
  openCommand = "cmd";
  openArgs = ["/c", "start", "", reportIndexPath];
} else if (process.platform === "darwin") {
  openCommand = "open";
  openArgs = [reportIndexPath];
} else {
  openCommand = "xdg-open";
  openArgs = [reportIndexPath];
}

const openResult = spawnSync(openCommand, openArgs, {
  cwd: rootDir,
  stdio: "ignore",
  env: mergedEnv,
});

if (openResult.error) {
  console.log(`Visual tests passed. Could not auto-open report: ${openResult.error.message}`);
  console.log(`Open manually: ${reportIndexPath}`);
  process.exit(0);
}

console.log(`Visual tests passed. Report opened: ${reportIndexPath}`);
process.exit(0);
