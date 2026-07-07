import { spawn } from "node:child_process";
import process from "node:process";

const port = process.env.PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const nextBin = "./node_modules/next/dist/bin/next";
const playwrightBin = "./node_modules/@playwright/test/cli.js";
const testArgs = process.argv.slice(2);

let serverExited = false;
let shuttingDown = false;

const server = spawn(process.execPath, [nextBin, "dev", "-p", port], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: port },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

server.once("exit", () => {
  serverExited = true;
});

server.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
});

server.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (serverExited) {
      throw new Error("Next dev server exited before it was ready.");
    }

    try {
      const response = await fetch(baseURL);
      if (response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until the dev server opens the port.
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${baseURL}`);
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function stopServer() {
  if (serverExited || shuttingDown) {
    return;
  }

  shuttingDown = true;
  server.kill();

  await Promise.race([waitForExit(server), delay(3_000)]);

  if (!serverExited) {
    server.kill("SIGKILL");
    await Promise.race([waitForExit(server), delay(1_000)]);
  }
}

async function run() {
  let exitCode = 1;

  try {
    await waitForServer();

    const tests = spawn(process.execPath, [playwrightBin, "test", ...testArgs], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: baseURL,
        PLAYWRIGHT_SKIP_WEBSERVER: "1",
      },
      stdio: "inherit",
      windowsHide: true,
    });

    exitCode = await waitForExit(tests);
  } finally {
    await stopServer();
  }

  process.exit(exitCode);
}

process.once("SIGINT", async () => {
  await stopServer();
  process.exit(130);
});

process.once("SIGTERM", async () => {
  await stopServer();
  process.exit(143);
});

run().catch(async (error) => {
  console.error(error);
  await stopServer();
  process.exit(1);
});
