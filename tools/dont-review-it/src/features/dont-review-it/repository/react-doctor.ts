#!/usr/bin/env node
import * as NodeServices from "@effect/platform-node/NodeServices";
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { type BuildTarget, BuildTargetName } from "@repo/config";
import { Console, Effect, Schema, type PlatformError } from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/unstable/process";

import { LINT_SEVERITY } from "../lint-rule-authoring/lint-rule-severity.ts";
import { filePathOf, path } from "../platform/path.ts";
import { capturedProcess } from "./captured-process.ts";
import { REACT_DOCTOR_SKIP_DETAIL, skippedOnlyByTimeout } from "./react-doctor-timeout.ts";
import { reactDoctorPassed } from "./react-doctor-verdict.ts";
import { repositoryRoot } from "./repository-root.ts";

interface Scan {
  readonly failed: boolean;
  readonly stderr: string;
  readonly stdout: string;
}

const Diagnostic = Schema.Struct({
  filePath: Schema.String,
  line: Schema.optionalKey(Schema.Finite),
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

const executable = path.join(
  path.dirname(filePathOf(new URL(import.meta.resolve("react-doctor")))),
  "..",
  "bin",
  "react-doctor.js",
);

const scan = (
  args: readonly string[],
): Effect.Effect<Scan, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> =>
  capturedProcess(
    ChildProcess.make(executable, [...args, "--no-score"], {
      cwd: repositoryRoot,
      stdin: "ignore",
    }),
  ).pipe(
    Effect.map(({ exitCode, stderr, stdout }) => ({ failed: exitCode !== 0, stderr, stdout })),
  );

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
    ...(entry.complete ? [] : [`${name} ${REACT_DOCTOR_SKIP_DETAIL.incomplete}`]),
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
  const rules = yield* Schema.decodeEffect(Rules)(listed.stdout).pipe(
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

const scanProjects = Effect.fn("scanProjects")(function* scanProjects(application: BuildTarget) {
  const target = `apps/${application}`;
  let attempt = 0;
  let scanned = yield* scan([target, "--json"]);
  let report = yield* Schema.decodeEffect(Report)(scanned.stdout).pipe(
    Effect.tapError(() => Console.error(scanned.stdout)),
  );
  while (attempt < SCAN_ATTEMPTS - 1 && skippedOnlyByTimeout(skippedIn(report))) {
    attempt += 1;
    yield* Console.error(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        attempt,
        event: "quality.react_doctor_retry",
        reason: "transient-analysis-failure",
      }),
    );
    scanned = yield* scan([target, "--json"]);
    report = yield* Schema.decodeEffect(Report)(scanned.stdout).pipe(
      Effect.tapError(() => Console.error(scanned.stdout)),
    );
  }
  return { report, scanned };
});

const reportScanError = ({
  failed,
  stderr,
}: {
  readonly failed: boolean;
  readonly stderr: string;
}): Effect.Effect<void> => (failed && stderr !== "" ? Console.error(stderr) : Effect.void);

const errorMessageOf = (report: typeof Scanned.Type): string | undefined => report.error?.message;

const inspect = Effect.fn("inspect")(function* inspect(application: BuildTarget) {
  const [{ report, scanned }, listed] = yield* Effect.all(
    [scanProjects(application), scan(["rules", "list", "--json", "-c", "tools/dont-review-it"])],
    { concurrency: "unbounded" },
  );
  yield* reportScanError(scanned);
  const unclassified = yield* unclassifiedRules(listed);
  const findings = report.projects.flatMap((entry) => findingsOf(entry));
  const skipped = skippedIn(report);
  const found = new Set(report.projects.map((entry) => entry.project.projectName));
  const missing = [`@repo/${application}`].filter((name) => !found.has(name));
  const error = errorMessageOf(report);
  const projects = report.projects.length;
  return {
    application,
    error,
    findings,
    missing,
    ok: reactDoctorPassed({
      error,
      failed: scanned.failed || listed.failed,
      findings,
      missing,
      projects,
      skipped,
      unclassified,
    }),
    projects,
    skipped,
    unclassified,
  };
});

runCli(
  Effect.gen(function* run() {
    const application = yield* Schema.decodeUnknownEffect(BuildTargetName)(
      path.basename(process.cwd()),
    );
    const result = yield* inspect(application);
    yield* Console.log(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        event: "quality.react_doctor",
        ...result,
      }),
    );
    if (!result.ok) {
      yield* markFailed;
    }
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => causeRecord("quality.react_doctor_failed", { cause }),
);
