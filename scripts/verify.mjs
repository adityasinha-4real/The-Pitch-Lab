// Runs every gate in order and stops at the first failure.
import { spawnSync } from "node:child_process";

const steps = [
  ["docs + banned words", "pnpm", ["check:docs"]],
  ["lint", "pnpm", ["lint"]],
  ["typecheck", "pnpm", ["typecheck"]],
  ["unit + db tests", "pnpm", ["test"]],
  ["build", "pnpm", ["build"]],
  ["e2e", "pnpm", ["test:e2e"]],
];

const started = Date.now();
for (const [label, cmd, args] of steps) {
  const t = Date.now();
  console.log(`\n━━━ verify: ${label} ━━━`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error(`\n✗ verify failed at "${label}" (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
  console.log(`✓ ${label} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
console.log(`\n✓ verify passed: ${steps.length} steps in ${((Date.now() - started) / 1000).toFixed(0)}s`);
