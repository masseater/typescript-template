import { Effect, type FileSystem, type PlatformError } from "effect";
import { parseSync } from "oxc-parser";

import { listRepositoryFiles } from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { defaultExportedValue, unwrappedCall, valueAt } from "../lint/oxlint/lib/config-object.ts";
import { textOrNull } from "../platform/file-system.ts";
import { path, posixPath } from "../platform/path.ts";

import type { RepositoryProblem, ScannedProblems } from "../repository-checks/index.ts";
import type { TelemetryWiringConfig } from "./config.ts";

const configDirectoriesIn = (repositoryRoot: string): readonly string[] =>
  listRepositoryFiles(repositoryRoot)
    .manifests.map((manifest) => posixPath.dirname(manifest.relativePath))
    .toSorted();

const declaredAt = ({
  held,
  fieldPath,
}: {
  readonly held: unknown;
  readonly fieldPath: readonly string[];
}): boolean =>
  fieldPath.length === 0
    ? held !== null
    : declaredAt({
        held: valueAt({ held, key: fieldPath[0] as string }),
        fieldPath: fieldPath.slice(1),
      });

const problemsIn = ({
  relativePath,
  source,
  config,
}: {
  readonly relativePath: string;
  readonly source: string;
  readonly config: TelemetryWiringConfig;
}): readonly RepositoryProblem[] => {
  const measured = unwrappedCall(
    valueAt({
      held: defaultExportedValue(parseSync(relativePath, source).program),
      key: config.measuredBlockFieldName,
    }),
  );
  if (measured === null) return [];
  if (declaredAt({ held: measured, fieldPath: config.wiringFieldPath })) return [];

  return [
    {
      file: relativePath,
      line: 1,
      message: `A ${config.measuredBlockFieldName} block must not run without telemetry, because a workspace nobody measures is indistinguishable from a workspace that is fast. Declare ${config.wiringFieldPath.join(".")} in this block.`,
    },
  ];
};

export const runTelemetryWiringChecks = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: TelemetryWiringConfig;
}): Effect.Effect<ScannedProblems, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* runTelemetryWiringChecks() {
    const directories = configDirectoriesIn(repositoryRoot);
    const problems = yield* Effect.forEach(directories, (directory) => {
      const relativePath = posixPath.join(directory, config.toolchainConfigFileName);
      return Effect.map(textOrNull(path.join(repositoryRoot, relativePath)), (source) =>
        source === null ? [] : problemsIn({ relativePath, source, config }),
      );
    });
    return { problems: problems.flat(), scanned: directories.length };
  });
