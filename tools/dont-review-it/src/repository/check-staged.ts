#!/usr/bin/env node
import { markFailed, runCli } from "@repo/cli";
import { Cause, Console, Effect, Option } from "effect";

import { deploymentCredentials } from "./credentials.ts";
import { repositoryRoot } from "./repository-root.ts";
import { indexSecretHits } from "./staged.ts";

const scanIndex = Effect.fn("scanIndex")(function* scanIndex() {
  const credentials = yield* deploymentCredentials(repositoryRoot);
  const { hits, scan } = yield* indexSecretHits(repositoryRoot, credentials.values);
  const status =
    hits.length > 0
      ? ("failed" as const)
      : credentials.source === "absent"
        ? ("degraded" as const)
        : ("passed" as const);
  return { credentials: credentials.source, failures: hits, scan, status };
});

const uncheckedRecord = (
  detail: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  return { event: "quality.staged_secrets_failed", ok: false, status: "failed", ...detail };
};

runCli(
  scanIndex().pipe(
    Effect.flatMap(({ credentials, failures, scan, status }) =>
      Console.log(
        JSON.stringify({
          credentials,
          event: "quality.staged_secrets",
          failures,
          ok: status !== "failed",
          prefixScan: scan,
          status,
        }),
      ).pipe(Effect.andThen(status === "failed" ? markFailed : Effect.void)),
    ),
  ),
  (cause) => {
    const failure = Option.getOrUndefined(Cause.findErrorOption(cause));
    if (failure !== undefined) {
      return uncheckedRecord(failure.report);
    }
    const defect: unknown = Cause.squash(cause);
    return uncheckedRecord({
      error: defect instanceof Error ? defect.name : typeof defect,
      reason: "unexpected",
    });
  },
);
