// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Schema } from "effect";

import { secretsFile } from "@repo/config/deployment";

import { deploymentValues, prefixScan, secretViolations } from "./secrets.ts";
import type { DeploymentValue } from "./secrets.ts";
import { stagedFiles } from "./staged.ts";
import type { StagedFile } from "./staged.ts";

const FAILED_EXIT_CODE = 1;

const root = fileURLToPath(new URL("../../", import.meta.url));

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

const scanStaged = Effect.fn("scanStaged")(function* scanStaged() {
  const values = yield* environmentValues;
  const staged = yield* stagedFiles(root);
  const scan = prefixScan(
    values,
    staged.map((entry: StagedFile) => entry.content),
  );
  const failures = staged.flatMap((entry: StagedFile) => {
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
