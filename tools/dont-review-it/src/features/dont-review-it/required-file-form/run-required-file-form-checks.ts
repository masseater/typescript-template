import { Effect, type FileSystem, type PlatformError } from "effect";

import { agentInstructionLinksIn } from "./agent-instruction-links.ts";
import { foreignToolConfigsIn } from "./foreign-tool-configs.ts";
import { packageRootsIn } from "./package-roots.ts";

import type { ScannedProblems } from "../repository-checks/index.ts";
import type { RequiredFileFormConfig } from "./config.ts";

export const runRequiredFileFormChecks = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: RequiredFileFormConfig;
}): Effect.Effect<ScannedProblems, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* runRequiredFileFormChecks() {
    const packageRoots = packageRootsIn(repositoryRoot);
    const problems = yield* Effect.forEach(packageRoots, (packageRoot) =>
      Effect.gen(function* packageRootProblems() {
        const foreignConfigs = yield* foreignToolConfigsIn({ repositoryRoot, packageRoot, config });
        const linkProblems = yield* agentInstructionLinksIn({
          repositoryRoot,
          packageRoot,
          config,
        });
        return [...foreignConfigs, ...linkProblems];
      }),
    );
    return { problems: problems.flat(), scanned: packageRoots.length };
  });
