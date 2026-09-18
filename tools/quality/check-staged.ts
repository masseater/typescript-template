// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect, Option } from "effect";

import { deploymentCredentials } from "./credentials.ts";
import { prefixScan, secretViolations } from "./secrets.ts";
import { stagedFiles } from "./staged.ts";

import type { StagedFile } from "./staged.ts";

const FAILED_EXIT_CODE = 1;

const root = fileURLToPath(new URL("../../", import.meta.url));

const scanStaged = Effect.fn("scanStaged")(function* scanStaged() {
  const credentials = yield* deploymentCredentials(root);
  const staged = yield* stagedFiles(root);
  const scan = prefixScan(
    credentials.values,
    staged.map((entry: StagedFile) => entry.content),
  );
  const failures = staged.flatMap((entry: StagedFile) => {
    const rules = secretViolations(entry, credentials.values, scan);
    return rules.length > 0 ? [{ file: entry.filename, rules }] : [];
  });
  return { credentials: credentials.source, failures, scan };
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
    Effect.flatMap(({ credentials, failures, scan }) =>
      Console.log(
        JSON.stringify({
          credentials,
          event: "quality.staged_secrets",
          failures,
          ok: failures.length === 0,
          prefixScan: scan,
        }),
      ).pipe(Effect.andThen(failures.length > 0 ? markFailed : Effect.void)),
    ),
    Effect.catchCause((cause) => {
      const failure = Option.getOrUndefined(Cause.findErrorOption(cause));
      if (failure !== undefined) {
        return reportUnchecked(failure.report);
      }
      const defect: unknown = Cause.squash(cause);
      return reportUnchecked({
        error: defect instanceof Error ? defect.name : typeof defect,
        reason: "unexpected",
      });
    }),
  ),
  { disableErrorReporting: true },
);
