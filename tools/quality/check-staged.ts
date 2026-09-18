// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Schema } from "effect";

import { secretsFile } from "@template/config/deployment";

import { deploymentValues, prefixScan, secretViolations } from "./secrets.ts";
import type { DeploymentValue } from "./secrets.ts";

const MAX_OUTPUT_BYTES = 33_554_432;
const FAILED_EXIT_CODE = 1;

// oxlint-disable-next-line typescript/strict-void-return
const run = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const options = { cwd: root, maxBuffer: MAX_OUTPUT_BYTES };

function git(args: readonly string[]): Effect.Effect<string, unknown> {
  return Effect.tryPromise(async () => run("git", [...args], options)).pipe(
    Effect.map(({ stdout }) => stdout),
  );
}

const Manifest = Schema.fromJsonString(Schema.Struct({ name: Schema.String }));

class Unreadable extends Schema.TaggedError<Unreadable>()("Unreadable", {}) {}

function read(filename: string): Effect.Effect<string, Unreadable> {
  return Effect.tryPromise({
    catch: () => new Unreadable(),
    try: async () => readFile(filename, "utf-8"),
  });
}

const environmentValues = read(path.join(root, "package.json")).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(Manifest)),
  Effect.flatMap(({ name }) => read(secretsFile(name))),
  Effect.map(deploymentValues),
  Effect.orElseSucceed((): readonly DeploymentValue[] => []),
);

function stagedFile(
  filename: string,
): Effect.Effect<{ content: string; filename: string }, unknown> {
  return git(["show", `:${filename}`]).pipe(Effect.map((content) => ({ content, filename })));
}

const scanStaged = Effect.fn("scanStaged")(function* scanStaged() {
  const values = yield* environmentValues;
  const listed = yield* git(["ls-files", "--cached", "-z"]);
  const files = listed.split("\0").filter(Boolean);
  const staged = yield* Effect.all(files.map((file) => stagedFile(file)));
  const scan = prefixScan(
    values,
    staged.map((entry: Readonly<{ content: string }>) => entry.content),
  );
  const failures = staged.flatMap((entry: Readonly<{ content: string; filename: string }>) => {
    const rules = secretViolations(entry, values, scan);
    return rules.length > 0 ? [{ file: entry.filename, rules }] : [];
  });
  return { failures, scan };
});

NodeRuntime.runMain(
  scanStaged().pipe(
    Effect.flatMap(({ failures, scan }) =>
      Console.log(
        JSON.stringify({
          event: "quality.staged_secrets",
          failures,
          ok: failures.length === 0,
          prefixScan: scan,
        }),
      ).pipe(
        Effect.andThen(
          Effect.sync(() => {
            if (failures.length > 0) {
              process.exitCode = FAILED_EXIT_CODE;
            }
          }),
        ),
      ),
    ),
    Effect.catchCause(() =>
      Console.error(JSON.stringify({ event: "quality.staged_secrets_failed", ok: false })).pipe(
        Effect.andThen(
          Effect.sync(() => {
            process.exitCode = FAILED_EXIT_CODE;
          }),
        ),
      ),
    ),
  ),
  { disableErrorReporting: true },
);
