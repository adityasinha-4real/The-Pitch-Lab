// Starts the production server for Playwright. Rebuilds first only if the
// build is missing or older than any source file, so `pnpm verify` (which
// builds just before) doesn't build twice.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const buildId = path.join(root, ".next", "BUILD_ID");

function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs);
  }
  return newest;
}

const sources = ["src", "supabase", "public"].map((d) => newestMtime(path.join(root, d)));
const configFiles = ["next.config.ts", "package.json", "postcss.config.mjs"].map((f) => statSync(path.join(root, f)).mtimeMs);
const stale = !existsSync(buildId) || Math.max(...sources, ...configFiles) > statSync(buildId).mtimeMs;

if (stale) {
  console.log("[e2e-server] build missing or stale, running next build");
  const r = spawnSync("pnpm", ["build"], { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const child = spawn("pnpm", ["exec", "next", "start", "-p", process.env.PORT ?? "3100"], { stdio: "inherit", shell: true });
const stop = () => child.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", (code) => process.exit(code ?? 0));
