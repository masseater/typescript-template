import { localDatabasePersistence, writeLocalDatabaseConfig } from "./local.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { createRequire } from "node:module";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

const MAX_OUTPUT_BYTES = 16_777_216;

const wrangler = path.join(
  path.dirname(createRequire(import.meta.url).resolve("wrangler/package.json")),
  "bin/wrangler.js",
);

try {
  const config = await writeLocalDatabaseConfig();
  // oxlint-disable-next-line typescript/strict-void-return
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      wrangler,
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--config",
      config,
      "--persist-to",
      localDatabasePersistence,
    ],
    { maxBuffer: MAX_OUTPUT_BYTES },
  );
  process.stdout.write(stdout);
} catch {
  process.stderr.write(`${JSON.stringify({ action: "local_migration", success: false })}\n`);
  process.exitCode = 1;
}
