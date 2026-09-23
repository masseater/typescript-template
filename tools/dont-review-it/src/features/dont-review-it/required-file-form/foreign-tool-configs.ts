import { Effect, type FileSystem, type PlatformError } from "effect";

import { isFileAt } from "../platform/file-system.ts";
import { path, posixPath } from "../platform/path.ts";

import type { RepositoryProblem } from "../problem.ts";
import type { RequiredFileFormConfig, ToolConfigFormats } from "./config.ts";

const configsOf = ({
  repositoryRoot,
  packageRoot,
  tool,
}: {
  readonly repositoryRoot: string;
  readonly packageRoot: string;
  readonly tool: ToolConfigFormats;
}): Effect.Effect<
  readonly RepositoryProblem[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* configsOf() {
    const present = yield* Effect.filter(tool.foreignFileNames, (fileName) =>
      isFileAt(path.join(repositoryRoot, packageRoot, fileName)),
    );
    return present.map((fileName) => ({
      file: posixPath.normalize(`${packageRoot}/${fileName}`),
      line: null,
      message: `A configuration for ${tool.toolName} must not stay in a format the type checker never reads. Move what it declares into ${tool.typeScriptFileName}.`,
    }));
  });

export const foreignToolConfigsIn = ({
  repositoryRoot,
  packageRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly packageRoot: string;
  readonly config: RequiredFileFormConfig;
}): Effect.Effect<
  readonly RepositoryProblem[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* foreignToolConfigsIn() {
    const perTool = yield* Effect.forEach(config.tools, (tool) =>
      configsOf({ repositoryRoot, packageRoot, tool }),
    );
    return perTool.flat();
  });
