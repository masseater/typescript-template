import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

import { markFailed, runCli } from "@repo/config/cli";
import { Console, Effect, Schema } from "effect";

import { repositoryRoot } from "./repository-root.ts";

interface Scan {
  readonly failed: boolean;
  readonly stderr: string;
  readonly stdout: string;
}

const MAX_OUTPUT_BYTES = 33_554_432;

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

const executable = fileURLToPath(new URL("../../node_modules/.bin/react-doctor", import.meta.url));

const scan = (args: readonly string[]): Effect.Effect<Scan> => {
  return Effect.promise(
    async () =>
      new Promise<Scan>((resolve) => {
        execFile(
          executable,
          [...args, "--no-score"],
          { cwd: repositoryRoot, maxBuffer: MAX_OUTPUT_BYTES },
          (failure, stdout, stderr) => {
            resolve({ failed: failure !== null, stderr, stdout });
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
    .filter((rule) => rule.source === "default" || rule.severity === "warn")
    .map((rule) => `${rule.key} ${rule.source} ${rule.severity}`);
});

const inspect = Effect.fn("inspect")(function* inspect() {
  const [{ failed, stderr, stdout }, listed] = yield* Effect.all(
    [scan(["tools/quality", "--json"]), scan(["rules", "list", "--json", "-c", "tools/quality"])],
    { concurrency: "unbounded" },
  );
  if (failed && stderr !== "") {
    yield* Console.error(stderr);
  }
  const report = yield* Schema.decodeUnknownEffect(Report)(stdout).pipe(
    Effect.tapError(() => Console.error(stdout)),
  );
  const unclassified = yield* unclassifiedRules(listed);
  const findings = report.projects.flatMap((entry) => findingsOf(entry));
  const skipped = [
    ...report.projects.flatMap((entry) => skippedOf(entry)),
    ...(report.skippedProjects ?? []).map(({ directory, reason }) => `${directory} ${reason}`),
  ];
  return {
    error: report.error?.message,
    findings,
    ok:
      !failed &&
      !listed.failed &&
      report.error === null &&
      findings.length === 0 &&
      skipped.length === 0 &&
      unclassified.length === 0,
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
  { event: "quality.react_doctor_failed", ok: false },
);
