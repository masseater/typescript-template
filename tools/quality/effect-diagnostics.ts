import { Console, Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { readdir } from "node:fs/promises";

interface Diagnosis {
  readonly ok: boolean;
  readonly output: string;
  readonly project: string;
}

const MAX_OUTPUT_BYTES = 33_554_432;
const DIAGNOSTIC_CONCURRENCY = 4;

const root = fileURLToPath(new URL("../../", import.meta.url));
const executable = fileURLToPath(new URL("../../node_modules/.bin/effect-tsgo", import.meta.url));

function areaProjects(area: string): Effect.Effect<string[]> {
  return Effect.promise(async () =>
    readdir(new URL(`../../${area}/`, import.meta.url), { withFileTypes: true }),
  ).pipe(
    Effect.map((entries) =>
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${area}/${entry.name}/tsconfig.json`),
    ),
  );
}

function hasProject(project: string): Effect.Effect<boolean> {
  return Effect.promise(async () =>
    access(new URL(`../../${project}`, import.meta.url)).then(
      () => true,
      () => false,
    ),
  );
}

function diagnose(project: string): Effect.Effect<Diagnosis> {
  return Effect.promise(
    async () =>
      // oxlint-disable-next-line promise/avoid-new
      new Promise<Diagnosis>((resolve) => {
        execFile(
          executable,
          ["diagnostics", "--project", `${root}${project}`, "--format", "text", "--strict"],
          { cwd: root, maxBuffer: MAX_OUTPUT_BYTES },
          (failure, stdout, stderr) => {
            resolve({ ok: failure === null, output: `${stdout}${stderr}`, project });
          },
        );
      }),
  );
}

const diagnoseAll = Effect.fn("diagnoseAll")(function* diagnoseAll() {
  const areas = yield* Effect.all(
    ["apps", "libs", "infra", "tools"].map((area) => areaProjects(area)),
  );
  const candidates = ["tsconfig.json", ...areas.flat()];
  const present = yield* Effect.all(candidates.map((project) => hasProject(project)));
  const projects = candidates.filter((_project, index) => present[index] === true);
  return yield* Effect.all(
    projects.map((project) => diagnose(project)),
    { concurrency: DIAGNOSTIC_CONCURRENCY },
  );
});

NodeRuntime.runMain(
  diagnoseAll().pipe(
    Effect.flatMap((results) =>
      Effect.gen(function* report() {
        const failed = results.filter((result) => !result.ok);
        for (const result of failed) {
          yield* Console.error(result.output);
        }
        yield* Console.log(
          JSON.stringify({
            event: "quality.effect_diagnostics",
            failed: failed.map((result) => result.project),
            ok: failed.length === 0,
            projects: results.length,
          }),
        );
        if (failed.length > 0) {
          process.exitCode = 1;
        }
      }),
    ),
  ),
  { disableErrorReporting: true },
);
