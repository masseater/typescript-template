import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { localDatabasePersistence, writeLocalDatabaseConfig } from "./local.ts";

const run = promisify(execFile);
const wrangler = path.join(
  path.dirname(createRequire(import.meta.url).resolve("wrangler/package.json")),
  "bin/wrangler.js",
);

try {
  const config = await writeLocalDatabaseConfig();
  const { stdout } = await run(
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
    { maxBuffer: 16 * 1024 * 1024 },
  );
  process.stdout.write(stdout);
} catch {
  console.error(JSON.stringify({ action: "local_migration", success: false }));
  process.exitCode = 1;
}
