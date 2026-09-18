import { Result, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

interface Scan {
  readonly failed: boolean;
  readonly output: string;
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
  diagnostics: Schema.Array(Diagnostic),
  project: Schema.Struct({ projectName: Schema.String }),
  skippedCheckReasons: Schema.optionalKey(Reasons),
  skippedChecks: Checks,
});
const Report = Schema.Struct({ projects: Schema.Array(Project) });

const root = fileURLToPath(new URL("../../", import.meta.url));
const executable = fileURLToPath(new URL("../../node_modules/.bin/react-doctor", import.meta.url));

async function scan(): Promise<Scan> {
  // oxlint-disable-next-line promise/avoid-new
  return new Promise<Scan>((resolve) => {
    execFile(
      executable,
      ["--json"],
      { cwd: root, maxBuffer: MAX_OUTPUT_BYTES },
      (failure, stdout) => {
        resolve({ failed: failure !== null, output: stdout });
      },
    );
  });
}

const { failed, output } = await scan();
const report = Schema.decodeUnknownResult(Report)(JSON.parse(output));
if (Result.isFailure(report)) {
  throw new Error("react-doctor のレポートを解釈できませんでした。");
}

const findings: string[] = [];
const skipped: string[] = [];
for (const entry of report.success.projects) {
  const name = entry.project.projectName;
  for (const diagnostic of entry.diagnostics) {
    const at = diagnostic.line === undefined ? "" : `:${diagnostic.line}`;
    findings.push(
      `${diagnostic.severity} ${diagnostic.rule} ${name}/${diagnostic.filePath}${at} ${diagnostic.message}`,
    );
  }
  for (const check of entry.skippedChecks) {
    skipped.push(`${name} ${check}`);
  }
  for (const [check, reason] of Object.entries(entry.skippedCheckReasons ?? {})) {
    skipped.push(`${name} ${check} ${reason}`);
  }
}

process.stdout.write(
  `${JSON.stringify({
    event: "quality.react_doctor",
    findings,
    ok: !failed && skipped.length === 0,
    projects: report.success.projects.length,
    skipped,
  })}\n`,
);
if (failed || skipped.length > 0) {
  process.exitCode = 1;
}
