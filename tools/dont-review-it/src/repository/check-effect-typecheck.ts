#!/usr/bin/env node
// oxlint-disable-next-line import/no-nodejs-modules
import { spawnSync } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { createRequire } from "node:module";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

const entry = createRequire(import.meta.url).resolve("@repo/vite-config");
const script = path.join(path.dirname(entry), "effect-typecheck.ts");
const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error !== undefined) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
