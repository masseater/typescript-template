import { Effect, type FileSystem, type PlatformError } from "effect";

import { path } from "../../platform/path.ts";
import { bundleNameOf, type BundledLintRule } from "./rule-bundle.ts";
import { lintRuleFactsIn } from "./rule-facts.ts";
import { ruleSourceFilesIn } from "./rule-source-files.ts";

import type { TreeFailure } from "../../platform/directory-entries.ts";
import type { LintRuleWorkspace } from "./lint-rule-workspaces.ts";

export type WorkspaceRules = {
  readonly rules: readonly BundledLintRule[];
  readonly absentDirectories: readonly string[];
};

export const workspaceRulesOf = ({
  repositoryRoot,
  workspace,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
}): Effect.Effect<
  WorkspaceRules,
  TreeFailure | PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* workspaceRulesOf() {
    const { sourcePaths, absentDirectories } = yield* ruleSourceFilesIn({
      repositoryRoot,
      workspace,
    });
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
    return { rules: rules.flat(), absentDirectories };
  });

export type WorkspaceRule = {
  readonly workspace: LintRuleWorkspace;
  readonly rule: BundledLintRule;
};

export const rulesAcross = ({
  repositoryRoot,
  workspaces,
}: {
  readonly repositoryRoot: string;
  readonly workspaces: readonly LintRuleWorkspace[];
}): Effect.Effect<
  readonly WorkspaceRule[],
  TreeFailure | PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.map(
    Effect.forEach(workspaces, (workspace) =>
      workspaceRulesOf({ repositoryRoot, workspace }).pipe(
        Effect.map(({ rules }) => rules.map((rule) => ({ workspace, rule }))),
      ),
    ),
    (workspaceRules) => workspaceRules.flat(),
  );
