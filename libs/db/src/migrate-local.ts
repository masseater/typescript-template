import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { localDatabasePersistence, writeLocalDatabaseConfig } from "./local.ts";

const run = promisify(execFile);
const wrangler = path.join(
  path.dirname(createRequire(import.meta.url).resolve("wrangler/package.json")),
  "bin/wrangler.js",
);

NodeRuntime.runMain(
  Effect.gen(function* () {
    const config = yield* Effect.tryPromise(() => writeLocalDatabaseConfig());
    const { stdout } = yield* Effect.tryPromise(() =>
      run(
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
      ),
    );
    process.stdout.write(stdout);
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(JSON.stringify({ action: "local_migration", success: false }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
