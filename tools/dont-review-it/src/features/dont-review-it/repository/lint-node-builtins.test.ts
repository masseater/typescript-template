import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema, type PlatformError } from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/unstable/process";
import { expect } from "vite-plus/test";

import { LINT_SEVERITY } from "../lint-rule-authoring/index.ts";
import { capturedProcess } from "./captured-process.ts";
import { lintOptions } from "./lint.ts";

const RULE = "import/no-nodejs-modules";
const LOADER_RULE = "project/process-boundary";

const LintReport = Schema.Struct({
  diagnostics: Schema.Array(Schema.Struct({ code: Schema.String, filename: Schema.String })),
});

const overridesOf = (rule: string) =>
  lintOptions.overrides.flatMap((override) => {
    const severity = (override.rules as Readonly<Record<string, unknown>>)[rule];
    return severity === undefined ? [] : [{ files: override.files, rules: { [rule]: severity } }];
  });

const ruleOverrides = overridesOf(RULE);

const exemptFiles = ruleOverrides
  .filter((override) => override.rules[RULE] === LINT_SEVERITY.OFF)
  .flatMap((override) => override.files);

const loaderExemptFiles = overridesOf(LOADER_RULE)
  .filter((override) => override.rules[LOADER_RULE] === LINT_SEVERITY.OFF)
  .flatMap((override) => override.files)
  .filter((file) => !file.includes("*"));

const nodeImport = 'import { env } from "node:process";\n\nexport { env };\n';

const builtinLoader = 'export const url = process.getBuiltinModule("node:url");\n';

const processOutput = 'process.stdout.write("done");\n';

const reportedFiles = ({
  probes,
  configuration,
  code,
}: {
  readonly probes: Readonly<Record<string, string>>;
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly code: string;
}): Effect.Effect<
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
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(configuration),
    );
    const probeFiles = Object.keys(probes);
    yield* Effect.forEach(Object.entries(probes), ([probeFile, source]) =>
      Effect.gen(function* writeProbe() {
        yield* filesystem.makeDirectory(paths.dirname(paths.join(root, probeFile)), {
          recursive: true,
        });
        yield* filesystem.writeFileString(paths.join(root, probeFile), source);
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
    return [
      ...new Set(
        report.diagnostics
          .filter((diagnostic) => diagnostic.code === code)
          .map((diagnostic) => diagnostic.filename),
      ),
    ].toSorted();
  }).pipe(Effect.scoped);

const importReports = (probeFiles: readonly string[]) =>
  reportedFiles({
    probes: Object.fromEntries(probeFiles.map((probeFile) => [probeFile, nodeImport])),
    configuration: {
      plugins: ["import"],
      rules: { [RULE]: lintOptions.rules[RULE] },
      overrides: ruleOverrides,
    },
    code: "import(no-nodejs-modules)",
  });

const loaderReports = (probes: Readonly<Record<string, string>>) =>
  reportedFiles({
    probes,
    configuration: {
      jsPlugins: lintOptions.jsPlugins.filter(
        (plugin) => typeof plugin === "object" && plugin.name === "project",
      ),
      rules: { [LOADER_RULE]: lintOptions.rules[LOADER_RULE] },
      overrides: overridesOf(LOADER_RULE),
    },
    code: "project(process-boundary)",
  });

layer(NodeServices.layer)("the node builtin import guard", (it) => {
  it.effect("rejects a node import in a file the configuration does not exempt", () =>
    Effect.gen(function* rejectsUnexempted() {
      const probeFile = "libs/config/src/features/config/process-environment.ts";
      expect(yield* importReports([probeFile])).toStrictEqual([probeFile]);
    }),
  );

  it.effect("rejects a node import in any vite config", () =>
    Effect.gen(function* rejectsViteConfig() {
      const probeFiles = ["libs/ui/vite.config.ts", "vite.config.ts"];
      expect(yield* importReports(probeFiles)).toStrictEqual(probeFiles.toSorted());
    }),
  );

  it.effect("stays quiet for every file the configuration names as a boundary", () =>
    Effect.gen(function* quietForExempted() {
      const namedFiles = exemptFiles.filter((file) => !file.includes("*"));
      expect(namedFiles).not.toStrictEqual([]);
      expect(yield* importReports(namedFiles)).toStrictEqual([]);
    }),
  );

  it.effect("rejects process.getBuiltinModule outside the template workspaces", () =>
    Effect.gen(function* rejectsLoaderEverywhere() {
      const probeFiles = [
        "knip.ts",
        "tools/ai-native-telemetry/src/features/ai-native-telemetry/probe.ts",
        "tools/dev/src/features/dev/probe.ts",
        "vite.config.ts",
      ];
      expect(
        yield* loaderReports(
          Object.fromEntries(probeFiles.map((probeFile) => [probeFile, builtinLoader])),
        ),
      ).toStrictEqual(probeFiles);
    }),
  );

  it.effect("keeps the full process boundary only inside the template workspaces", () =>
    Effect.gen(function* fullBoundaryInWorkspaces() {
      expect(
        yield* loaderReports({
          "libs/config/src/features/config/probe.ts": processOutput,
          "tools/dev/src/features/dev/probe.ts": processOutput,
          "vite.config.ts": processOutput,
        }),
      ).toStrictEqual(["libs/config/src/features/config/probe.ts"]);
    }),
  );

  it.effect("stays quiet for the files still loading builtins at runtime", () =>
    Effect.gen(function* quietForLoaderExempted() {
      expect(loaderExemptFiles).not.toStrictEqual([]);
      expect(
        yield* loaderReports(
          Object.fromEntries(loaderExemptFiles.map((probeFile) => [probeFile, builtinLoader])),
        ),
      ).toStrictEqual([]);
    }),
  );
});
