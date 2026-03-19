import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(currentDirectory, "..");
const nextBin = path.resolve(webRoot, "node_modules/next/dist/bin/next");
const args = process.argv.slice(2);

const child = spawn(process.execPath, ["--max-old-space-size=4096", nextBin, "dev", ...args], {
  cwd: webRoot,
  env: {
    ...process.env,
    LIFEKEEPER_NEXT_DIST_DIR: process.env.LIFEKEEPER_NEXT_DIST_DIR ?? ".next-dev",
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});