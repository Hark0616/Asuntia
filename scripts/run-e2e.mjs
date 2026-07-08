import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const nextBin = "./node_modules/next/dist/bin/next";
const playwrightBin = "./node_modules/@playwright/test/cli.js";
const testArgs = process.argv.slice(2);

let serverExited = false;
let shuttingDown = false;
let server;

function findOpenPort(preferredPort) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        findOpenPort(0).then(resolve, reject);
        return;
      }

      reject(error);
    });

    probe.listen(preferredPort, () => {
      const address = probe.address();
      const openPort = typeof address === "object" && address ? address.port : preferredPort;
      probe.close(() => resolve(String(openPort)));
    });
  });
}

async function startServer(port) {
  server = spawn(process.execPath, [nextBin, "dev", "-p", port], {
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
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isExistingWorkspaceServer(baseURL) {
  try {
    const response = await fetch(baseURL);
    if (response.status >= 500) {
      return false;
    }

    const body = await response.text();
    return body.includes("Asuntia");
  } catch {
    return false;
  }
}

async function waitForServer(baseURL) {
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
  if (!server || serverExited || shuttingDown) {
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
  let port = process.env.PORT;
  let baseURL = process.env.PLAYWRIGHT_BASE_URL;
  let shouldStartServer = !baseURL;

  if (!baseURL) {
    const defaultBaseURL = "http://localhost:3000";
    const existingWorkspaceServer =
      !port && (await isExistingWorkspaceServer(defaultBaseURL));

    if (existingWorkspaceServer) {
      baseURL = defaultBaseURL;
      shouldStartServer = false;
    } else {
      port = port ?? (await findOpenPort(3000));
      baseURL = `http://localhost:${port}`;
    }
  }

  try {
    if (shouldStartServer) {
      await startServer(port);
    }

    await waitForServer(baseURL);

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
