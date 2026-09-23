import { Effect, type FileSystem } from "effect";
import { countBy } from "es-toolkit";

import { posixPath } from "../../platform/path.ts";
import { generatedFileProblems, staleGeneratedFile } from "../reconcile-generated-file.ts";
import { REGENERATE_COMMAND } from "../regenerate-command.ts";
import {
  lintRuleWorkspacesIn,
  type LintRuleWorkspace,
  type LintRuleWorkspaceFailure,
} from "./lint-rule-workspaces.ts";
import { renderRuleIndex } from "./render-rule-index.ts";
import { bundleNamesIn } from "./rule-bundle.ts";
import { shippedRuleReferenceProblems } from "./shipped-rule-reference.ts";
import { workspaceRulesOf } from "./workspace-rules.ts";

import type { LintRuleCheckReport, LintRuleProblem } from "../lint-rule-problem.ts";

const BEGIN_MARKER = "<!-- BEGIN GENERATED lint-rules -->";

const END_MARKER = "<!-- END GENERATED lint-rules -->";

const scaffoldOf = (block: string): string =>
  `# Lint rule index\n\nEvery lint rule this workspace implements. Generated from the rule sources; refresh it with \`${REGENERATE_COMMAND}\` rather than editing it.\n\n${block}\n`;

const missingIndex = (file: string): string =>
  `A workspace that declares lint rules must not go without \`${file}\`. Generate it with \`${REGENERATE_COMMAND}\`.`;

const staleIndex = (file: string): string =>
  staleGeneratedFile({ file, behind: "the rule implementations" });

const duplicatedRuleName = ({
  ruleName,
  workspaceDir,
}: {
  readonly ruleName: string;
  readonly workspaceDir: string;
}): string =>
  `Two rules in \`${workspaceDir}\` must not share the name \`${ruleName}\`; they claim the same document. Rename one of them.`;

const unbundledShippedRule = ({
  ruleName,
  workspaceDir,
}: {
  readonly ruleName: string;
  readonly workspaceDir: string;
}): string =>
  `A rule the preset carries must not sit outside a bundle directory once \`${workspaceDir}\` declares bundles. Move \`${ruleName}\` under the directory of the bundle that carries it, or declare \`shipped: false\` on it.`;

const absentRuleDirectory = ({
  ruleDirectory,
  workspaceDir,
}: {
  readonly ruleDirectory: string;
  readonly workspaceDir: string;
}): string =>
  `A workspace must not declare a rule directory that is not there, because the index then lists no rule from it and every rule check passes with nothing read. Create \`${posixPath.join(workspaceDir, ruleDirectory)}\` or remove it from \`lintRules\`.`;

const reconcileWorkspace = ({
  repositoryRoot,
  workspace,
  write,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
  readonly write: boolean;
}): Effect.Effect<readonly LintRuleProblem[], LintRuleWorkspaceFailure, FileSystem.FileSystem> =>
  Effect.gen(function* reconcileWorkspace() {
    const file = posixPath.join(workspace.workspaceDir, "docs", "lint", "index.md");
    const { rules, absentDirectories } = yield* workspaceRulesOf({ repositoryRoot, workspace });
    const absent = absentDirectories.map((ruleDirectory) => ({
      file: posixPath.join(workspace.workspaceDir, "package.json"),
      message: absentRuleDirectory({ ruleDirectory, workspaceDir: workspace.workspaceDir }),
    }));

    const duplicates = Object.entries(countBy(rules, (rule) => rule.name))
      .filter(([, spellings]) => spellings > 1)
      .map(([ruleName]) => ({
        file,
        message: duplicatedRuleName({ ruleName, workspaceDir: workspace.workspaceDir }),
      }));

    const strays =
      bundleNamesIn(rules).length === 0
        ? []
        : rules
            .filter((rule) => rule.shipped && rule.bundle === null)
            .map((rule) => ({
              file: posixPath.join(workspace.workspaceDir, rule.sourcePath),
              message: unbundledShippedRule({
                ruleName: rule.name,
                workspaceDir: workspace.workspaceDir,
              }),
            }));

    const indexProblems = yield* generatedFileProblems({
      repositoryRoot,
      file,
      begin: BEGIN_MARKER,
      end: END_MARKER,
      expected: renderRuleIndex(rules),
      scaffold: scaffoldOf,
      absent: missingIndex,
      stale: staleIndex,
      write,
    });
    const referenceProblems = yield* shippedRuleReferenceProblems({
      repositoryRoot,
      workspaceDir: workspace.workspaceDir,
      rules,
      write,
    });
    return [...absent, ...duplicates, ...strays, ...indexProblems, ...referenceProblems];
  });

export const lintRuleIndexProblems = ({
  repositoryRoot,
  write,
}: {
  readonly repositoryRoot: string;
  readonly write: boolean;
}): Effect.Effect<LintRuleCheckReport, LintRuleWorkspaceFailure, FileSystem.FileSystem> =>
  Effect.gen(function* lintRuleIndexProblems() {
    const workspaces = yield* lintRuleWorkspacesIn(repositoryRoot);
    const problems = yield* Effect.forEach(workspaces, (workspace) =>
      reconcileWorkspace({ repositoryRoot, workspace, write }),
    );
    return { problems: problems.flat(), scanned: workspaces.length };
  });
