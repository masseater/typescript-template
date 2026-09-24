import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema, type PlatformError } from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/unstable/process";
import { expect } from "vite-plus/test";

import { LINT_SEVERITY } from "../lint-rule-authoring/index.ts";
import { capturedProcess } from "./captured-process.ts";
import { lintOptions } from "./lint.ts";

const RULE = "import/no-nodejs-modules";

const LintReport = Schema.Struct({
  diagnostics: Schema.Array(Schema.Struct({ code: Schema.String, filename: Schema.String })),
});

const ruleOverrides = lintOptions.overrides.flatMap((override) => {
  const severity = (override.rules as Readonly<Record<string, unknown>>)[RULE];
  return severity === undefined ? [] : [{ files: override.files, rules: { [RULE]: severity } }];
});

const exemptFile = ruleOverrides.find((override) => override.rules[RULE] === LINT_SEVERITY.OFF)
  ?.files[0];

const reportedFiles = (
  probeFiles: readonly string[],
): Effect.Effect<
  readonly string[],
  PlatformError.BadArgument | PlatformError.PlatformError | Schema.SchemaError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.gen(function* lintProbes() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const root = yield* filesystem.makeTempDirectoryScoped({
      prefix: "dont-review-it-node-builtins-",
    });
    yield* filesystem.writeFileString(
      paths.join(root, "oxlint.json"),
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        plugins: ["import"],
        rules: { [RULE]: lintOptions.rules[RULE] },
        overrides: ruleOverrides,
      }),
    );
    yield* Effect.forEach(probeFiles, (probeFile) =>
      Effect.gen(function* writeProbe() {
        yield* filesystem.makeDirectory(paths.dirname(paths.join(root, probeFile)), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(root, probeFile),
          'import { env } from "node:process";\n\nexport { env };\n',
        );
      }),
    );
    const oxlint = paths.join(
      paths.dirname(yield* paths.fromFileUrl(new URL(import.meta.resolve("oxlint/package.json")))),
      "bin",
      "oxlint",
    );
    const linted = yield* capturedProcess(
      ChildProcess.make(oxlint, ["-c", "oxlint.json", "--format", "json", ...probeFiles], {
        cwd: root,
      }),
    );
    const report = yield* Schema.decodeEffect(Schema.fromJsonString(LintReport))(linted.stdout);
    return report.diagnostics
      .filter((diagnostic) => diagnostic.code === "import(no-nodejs-modules)")
      .map((diagnostic) => diagnostic.filename);
  }).pipe(Effect.scoped);

layer(NodeServices.layer)("the node builtin import guard", (it) => {
  it.effect("rejects a node import in a file the configuration does not exempt", () =>
    Effect.gen(function* rejectsUnexempted() {
      const probeFile = "libs/config/src/features/config/process-environment.ts";
      expect(yield* reportedFiles([probeFile])).toStrictEqual([probeFile]);
    }),
  );

  it.effect("stays quiet for a file the configuration names as a boundary", () =>
    Effect.gen(function* quietForExempted() {
      expect(exemptFile).toBeTypeOf("string");
      expect(yield* reportedFiles([String(exemptFile)])).toStrictEqual([]);
    }),
  );
});
