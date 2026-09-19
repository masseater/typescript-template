import { markFailed, runCli } from "@repo/config/cli";
import { Cause, Console, Effect, Option } from "effect";

import { deploymentCredentials } from "./credentials.ts";
import { repositoryRoot } from "./repository-root.ts";
import { prefixScan, secretViolations } from "./secrets.ts";
import { stagedFiles, type StagedFile } from "./staged.ts";

const scanStaged = Effect.fn("scanStaged")(function* scanStaged() {
  const credentials = yield* deploymentCredentials(repositoryRoot);
  const staged = yield* stagedFiles(repositoryRoot);
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

const uncheckedRecord = (
  detail: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  return { event: "quality.staged_secrets_failed", ok: false, ...detail };
};

runCli(
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
