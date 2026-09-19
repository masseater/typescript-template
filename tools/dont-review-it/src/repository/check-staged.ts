#!/usr/bin/env node
import { markFailed, runCli } from "@repo/config/cli";
import { Cause, Console, Effect, Option } from "effect";

import { deploymentCredentials } from "./credentials.ts";
import { repositoryRoot } from "./repository-root.ts";
import { indexSecretHits } from "./staged.ts";

const scanIndex = Effect.fn("scanIndex")(function* scanIndex() {
  const credentials = yield* deploymentCredentials(repositoryRoot);
  const { hits, scan } = yield* indexSecretHits(repositoryRoot, credentials.values);
  return { credentials: credentials.source, failures: hits, scan };
});

const uncheckedRecord = (
  detail: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  return { event: "quality.staged_secrets_failed", ok: false, ...detail };
};

runCli(
  scanIndex().pipe(
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
