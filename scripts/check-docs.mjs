// Verify gate 1: the project docs exist and are filled in, and shipped code
// contains no lorem / TODO / placeholder copy.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

for (const [file, mustContain] of [
  ["SPEC.md", "- ["],
  ["CLAUDE.md", "## Commands"],
  ["DECISIONS.md", "## D1"],
]) {
  const p = path.join(root, file);
  if (!existsSync(p)) errors.push(`${file} is missing`);
  else if (!readFileSync(p, "utf8").includes(mustContain)) errors.push(`${file} doesn't look filled in`);
}

const spec = existsSync(path.join(root, "SPEC.md")) ? readFileSync(path.join(root, "SPEC.md"), "utf8") : "";
const done = (spec.match(/^- \[x\]/gm) ?? []).length;
const open = (spec.match(/^- \[ \]/gm) ?? []).length;

const BANNED = /\b(lorem|ipsum|TODO|FIXME|XXX|TBD)\b|placeholder/i;
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) scan(p);
    else if (/\.(tsx?|css|sql|mjs)$/.test(name)) {
      readFileSync(p, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (BANNED.test(line)) errors.push(`${path.relative(root, p)}:${i + 1}: ${line.trim()}`);
        });
    }
  }
}
scan(path.join(root, "src"));
scan(path.join(root, "supabase"));

if (errors.length) {
  console.error("check-docs failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`check-docs ok: docs present, no banned words in src/ or supabase/. SPEC: ${done} done, ${open} open.`);
