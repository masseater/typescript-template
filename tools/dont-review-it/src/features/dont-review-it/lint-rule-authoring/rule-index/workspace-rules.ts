import { Effect, type FileSystem, type PlatformError } from "effect";

import { path } from "../../platform/path.ts";
import { bundleNameOf, type BundledLintRule } from "./rule-bundle.ts";
import { lintRuleFactsIn } from "./rule-facts.ts";
import { ruleSourceFilesIn } from "./rule-source-files.ts";

import type { LintRuleWorkspace } from "./lint-rule-workspaces.ts";

export const workspaceRulesOf = ({
  repositoryRoot,
  workspace,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
}): Effect.Effect<readonly BundledLintRule[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* workspaceRulesOf() {
    const sourcePaths = yield* ruleSourceFilesIn({ repositoryRoot, workspace });
    const rules = yield* Effect.forEach(sourcePaths, (sourcePath) =>
      lintRuleFactsIn({
        workspaceRoot: path.join(repositoryRoot, workspace.workspaceDir),
        sourcePath,
      }).pipe(
        Effect.map((facts) =>
          facts.map((rule) => ({
            ...rule,
            bundle: bundleNameOf({ sourcePath, ruleDirectories: workspace.ruleDirectories }),
          })),
        ),
      ),
    );
    return rules.flat();
  });
