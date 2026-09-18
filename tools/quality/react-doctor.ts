import { Console, Effect, Schema } from "effect";
import { NodeRuntime } from "@effect/platform-node";
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
const Report = Schema.fromJsonString(Schema.Struct({ projects: Schema.Array(Project) }));

const root = fileURLToPath(new URL("../../", import.meta.url));
const executable = fileURLToPath(new URL("../../node_modules/.bin/react-doctor", import.meta.url));

function scan(): Effect.Effect<Scan> {
  return Effect.promise(
    async () =>
      // oxlint-disable-next-line promise/avoid-new
      new Promise<Scan>((resolve) => {
        execFile(
          executable,
          ["--json"],
          { cwd: root, maxBuffer: MAX_OUTPUT_BYTES },
          (failure, stdout) => {
            resolve({ failed: failure !== null, output: stdout });
          },
        );
      }),
  );
}

function findingsOf(entry: typeof Project.Type): string[] {
  const name = entry.project.projectName;
  return entry.diagnostics.map((diagnostic) => {
    const at = diagnostic.line === undefined ? "" : `:${diagnostic.line}`;
    return `${diagnostic.severity} ${diagnostic.rule} ${name}/${diagnostic.filePath}${at} ${diagnostic.message}`;
  });
}

function skippedOf(entry: typeof Project.Type): string[] {
  const name = entry.project.projectName;
  return [
    ...entry.skippedChecks.map((check) => `${name} ${check}`),
    ...Object.entries(entry.skippedCheckReasons ?? {}).map(
      ([check, reason]) => `${name} ${check} ${reason}`,
    ),
  ];
}

const inspect = Effect.fn("inspect")(function* inspect() {
  const { failed, output } = yield* scan();
  const { projects } = yield* Schema.decodeUnknownEffect(Report)(output);
  const findings = projects.flatMap((entry) => findingsOf(entry));
  const skipped = projects.flatMap((entry) => skippedOf(entry));
  return { findings, ok: !failed && skipped.length === 0, projects: projects.length, skipped };
});

NodeRuntime.runMain(
  inspect().pipe(
    Effect.flatMap((result) =>
      Effect.gen(function* report() {
        yield* Console.log(JSON.stringify({ event: "quality.react_doctor", ...result }));
        if (!result.ok) {
          process.exitCode = 1;
        }
      }),
    ),
  ),
);
