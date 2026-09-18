// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect, Option, Schema } from "effect";

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

const markFailed = Effect.sync(() => {
  process.exitCode = FAILED_EXIT_CODE;
});

function reportUnchecked(detail: Readonly<Record<string, unknown>>): Effect.Effect<void> {
  return Console.error(
    JSON.stringify({ event: "quality.staged_secrets_failed", ok: false, ...detail }),
  ).pipe(Effect.andThen(markFailed));
}

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
      ).pipe(Effect.andThen(failures.length > 0 ? markFailed : Effect.void)),
    ),
    Effect.catchCause((cause) => {
      const failure = Option.getOrUndefined(Cause.findErrorOption(cause));
      const defect: unknown = Cause.squash(cause);
      return reportUnchecked(
        failure?.report ?? {
          error: defect instanceof Error ? defect.name : typeof defect,
          reason: "unexpected",
        },
      );
    }),
  ),
  { disableErrorReporting: true },
);
