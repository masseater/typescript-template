import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { NodeRuntime } from "@effect/platform-node";
import { Effect, Schema } from "effect";

class DiagnosticsFailed extends Schema.TaggedError<DiagnosticsFailed>()("DiagnosticsFailed", {
  projects: Schema.Array(Schema.String),
}) {}

const root = fileURLToPath(new URL("../../", import.meta.url));
const executable = fileURLToPath(new URL("../../node_modules/.bin/effect-tsgo", import.meta.url));

const projects = Effect.promise(async () => {
  const found = ["tsconfig.json"];
  for (const area of ["apps", "libs", "infra", "tools"]) {
    const entries = await readdir(new URL(`../../${area}/`, import.meta.url), {
      withFileTypes: true,
    });
    for (const entry of entries)
      if (entry.isDirectory()) found.push(`${area}/${entry.name}/tsconfig.json`);
  }
  return found;
});

const exists = (project: string) =>
  Effect.promise(() =>
    readdir(new URL(`../../${project.replace(/tsconfig\.json$/, "")}`, import.meta.url)).then(
      (names) => names.includes("tsconfig.json"),
    ),
  );

const diagnose = (project: string) =>
  Effect.callback<{ readonly project: string; readonly ok: boolean; readonly output: string }>(
    (resume) => {
      execFile(
        executable,
        ["diagnostics", "--project", `${root}${project}`, "--format", "text", "--strict"],
        { cwd: root, maxBuffer: 32 * 1024 * 1024 },
        (error, stdout, stderr) => {
          resume(Effect.succeed({ project, ok: error === null, output: `${stdout}${stderr}` }));
        },
      );
    },
  );

NodeRuntime.runMain(
  Effect.gen(function* () {
    const candidates = yield* projects;
    const results = yield* Effect.forEach(yield* Effect.filter(candidates, exists), diagnose, {
      concurrency: 4,
    });
    const failed = results.filter((result) => !result.ok);
    for (const result of failed) process.stderr.write(result.output);
    console.log(
      JSON.stringify({
        event: "quality.effect_diagnostics",
        ok: failed.length === 0,
        projects: results.length,
        failed: failed.map((result) => result.project),
      }),
    );
    if (failed.length > 0)
      return yield* new DiagnosticsFailed({ projects: failed.map((result) => result.project) });
  }).pipe(
    Effect.catchTag("DiagnosticsFailed", () =>
      Effect.sync(() => {
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
