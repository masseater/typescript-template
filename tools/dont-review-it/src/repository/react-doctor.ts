#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { causeRecord, markFailed, runCli } from "@repo/cli";
import { applications } from "@repo/config";
import { Console, Effect, Schema } from "effect";

import { LINT_SEVERITY } from "../lint-rule-authoring/lint-rule-severity.ts";
import { ANALYSIS_TIMEOUT, skippedOnlyByTimeout } from "./react-doctor-timeout.ts";
import { repositoryRoot } from "./repository-root.ts";

interface Scan {
  readonly failed: boolean;
  readonly stderr: string;
  readonly stdout: string;
  readonly timedOut: boolean;
}

const MAX_OUTPUT_BYTES = 33_554_432;
const SCAN_TIMEOUT_MS = 360_000;

const Diagnostic = Schema.Struct({
  filePath: Schema.String,
  line: Schema.optionalKey(Schema.Number),
  message: Schema.String,
  rule: Schema.String,
  severity: Schema.String,
});
const Reasons = Schema.Record(Schema.String, Schema.String);
const Checks = Schema.Array(Schema.String);
const Project = Schema.Struct({
  complete: Schema.Boolean,
  diagnostics: Schema.Array(Diagnostic),
  project: Schema.Struct({ projectName: Schema.String }),
  skippedCheckReasons: Schema.optionalKey(Reasons),
  skippedChecks: Checks,
});
const SkippedProject = Schema.Struct({ directory: Schema.String, reason: Schema.String });
const Failure = Schema.Struct({ message: Schema.String });
const Scanned = Schema.Struct({
  error: Schema.NullOr(Failure),
  projects: Schema.Array(Project),
  skippedProjects: Schema.optionalKey(Schema.Array(SkippedProject)),
});
const Report = Schema.fromJsonString(Scanned);
const Rules = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({ key: Schema.String, severity: Schema.String, source: Schema.String }),
  ),
);

const require = createRequire(import.meta.url);
const executable = join(dirname(require.resolve("react-doctor")), "..", "bin", "react-doctor.js");

const scan = (args: readonly string[]): Effect.Effect<Scan> => {
  return Effect.promise(
    async () =>
      new Promise<Scan>((resolve) => {
        execFile(
          executable,
          [...args, "--no-score"],
          {
            cwd: repositoryRoot,
            killSignal: "SIGKILL",
            maxBuffer: MAX_OUTPUT_BYTES,
            timeout: SCAN_TIMEOUT_MS,
          },
          (failure, stdout, stderr) => {
            resolve({
              failed: failure !== null,
              stderr,
              stdout,
              timedOut: failure?.killed === true,
            });
          },
        );
      }),
  );
};

const findingsOf = (entry: typeof Project.Type): string[] => {
  const name = entry.project.projectName;
  return entry.diagnostics.map((diagnostic) => {
    const at = diagnostic.line === undefined ? "" : `:${diagnostic.line}`;
    return `${diagnostic.severity} ${diagnostic.rule} ${name}/${diagnostic.filePath}${at} ${diagnostic.message}`;
  });
};

const skippedOf = (entry: typeof Project.Type): string[] => {
  const name = entry.project.projectName;
  return [
    ...(entry.complete ? [] : [`${name} incomplete`]),
    ...entry.skippedChecks.map((check) => `${name} ${check}`),
    ...Object.entries(entry.skippedCheckReasons ?? {}).map(
      ([check, reason]) => `${name} ${check} ${reason}`,
    ),
  ];
};

const unclassifiedRules = Effect.fn("unclassifiedRules")(function* unclassifiedRules(listed: Scan) {
  if (listed.failed && listed.stderr !== "") {
    yield* Console.error(listed.stderr);
  }
  const rules = yield* Schema.decodeUnknownEffect(Rules)(listed.stdout).pipe(
    Effect.tapError(() => Console.error(listed.stderr)),
  );
  return rules
    .filter((rule) => rule.source === "default" || rule.severity === LINT_SEVERITY.WARN)
    .map((rule) => `${rule.key} ${rule.source} ${rule.severity}`);
});

const SCAN_ATTEMPTS = 3;

const skippedIn = (report: typeof Scanned.Type): string[] => [
  ...report.projects.flatMap((entry) => skippedOf(entry)),
  ...(report.skippedProjects ?? []).map(({ directory, reason }) => `${directory} ${reason}`),
];

const reportOf = Effect.fn("reportOf")(function* reportOf(scanned: Scan) {
  if (scanned.timedOut) {
    yield* Console.error(
      JSON.stringify({ event: "quality.react_doctor_deadline", timeoutMs: SCAN_TIMEOUT_MS }),
    );
    return yield* Effect.fail(new Error("react-doctor scan exceeded deadline"));
  }
  return yield* Schema.decodeUnknownEffect(Report)(scanned.stdout).pipe(
    Effect.tapError(() => Console.error(scanned.stdout)),
  );
});

const scanProjects = Effect.fn("scanProjects")(function* scanProjects() {
  let attempt = 0;
  let scanned = yield* scan(["tools/dont-review-it", "--json"]);
  let report = yield* reportOf(scanned);
  while (attempt < SCAN_ATTEMPTS - 1 && skippedOnlyByTimeout(skippedIn(report))) {
    attempt += 1;
    yield* Console.error(
      JSON.stringify({
        attempt,
        event: "quality.react_doctor_retry",
        reason: "transient-analysis-failure",
      }),
    );
    scanned = yield* scan(["tools/dont-review-it", "--json"]);
    report = yield* reportOf(scanned);
  }
  return { report, scanned };
});

const inspect = Effect.fn("inspect")(function* inspect() {
  const [{ report, scanned }, listed] = yield* Effect.all(
    [scanProjects(), scan(["rules", "list", "--json", "-c", "tools/dont-review-it"])],
    { concurrency: "unbounded" },
  );
  const { failed, stderr } = scanned;
  if (failed && stderr !== "") {
    yield* Console.error(stderr);
  }
  const unclassified = yield* unclassifiedRules(listed);
  const findings = report.projects.flatMap((entry) => findingsOf(entry));
  const skipped = skippedIn(report);
  const found = new Set(report.projects.map((entry) => entry.project.projectName));
  const missing = applications.map((name) => `@repo/${name}`).filter((name) => !found.has(name));
  return {
    error: report.error?.message,
    findings,
    missing,
    ok:
      !failed &&
      !listed.failed &&
      report.error === null &&
      findings.length === 0 &&
      skipped.length === 0 &&
      unclassified.length === 0 &&
      report.projects.length > 0 &&
      missing.length === 0,
    projects: report.projects.length,
    skipped,
    unclassified,
  };
});

runCli(
  inspect().pipe(
    Effect.flatMap((result) =>
      Console.log(JSON.stringify({ event: "quality.react_doctor", ...result })).pipe(
        Effect.andThen(result.ok ? Effect.void : markFailed),
      ),
    ),
  ),
  (cause) => causeRecord("quality.react_doctor_failed", cause),
);
