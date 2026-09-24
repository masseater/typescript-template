import { Effect, type FileSystem } from "effect";

import { textOrNull } from "../../platform/file-system.ts";
import { path } from "../../platform/path.ts";
import { normativeDocumentPlacesIn, normativeDocumentsIn } from "../../repository-checks/index.ts";
import { generatedFileProblems, staleGeneratedFile } from "../reconcile-generated-file.ts";
import { REGENERATE_COMMAND } from "../regenerate-command.ts";
import { lintRuleWorkspacesIn, type LintRuleWorkspaceFailure } from "./lint-rule-workspaces.ts";
import { renderGuidelineIndex, type GroundedLintRule } from "./render-guideline-index.ts";
import { rulesAcross } from "./workspace-rules.ts";

import type { LintRuleCheckReport } from "../lint-rule-problem.ts";

const GUIDELINE_INDEX_PATH = "docs/lint-rules-by-guideline.md";

const BEGIN_MARKER = "<!-- BEGIN GENERATED rules-by-guideline -->";

const END_MARKER = "<!-- END GENERATED rules-by-guideline -->";

const scaffoldOf = (block: string): string =>
  `# Rules by normative document\n\nWhich lint rules of this repository declare each normative document as their grounds. Collected from those declarations alone, so what the off-the-shelf rules and the other checks cover is not in it. Generated; refresh it with \`${REGENERATE_COMMAND}\` rather than editing it.\n\n${block}\n`;

const strandedIndex = (file: string): string =>
  `\`${file}\` must not stand while nothing keeps it fresh. This repository declares no place for its normative documents, so nothing regenerates the table. Declare \`normativeDocuments\` in the root manifest, or delete the table.`;

const missingIndex = (file: string): string =>
  `A repository whose rules name their grounds must not go without \`${file}\`. Generate it with \`${REGENERATE_COMMAND}\`.`;

const staleIndex = (file: string): string =>
  staleGeneratedFile({ file, behind: "the grounds its rules declare" });

export const guidelineIndexProblems = ({
  repositoryRoot,
  write,
}: {
  readonly repositoryRoot: string;
  readonly write: boolean;
}): Effect.Effect<LintRuleCheckReport, LintRuleWorkspaceFailure, FileSystem.FileSystem> =>
  Effect.gen(function* guidelineIndexProblems() {
    const workspaces = yield* lintRuleWorkspacesIn(repositoryRoot);
    const grounded: readonly GroundedLintRule[] = (yield* rulesAcross({
      repositoryRoot,
      workspaces,
    })).map(({ rule, workspace }) => ({ rule, workspaceDir: workspace.workspaceDir }));
    const normativeDocuments = normativeDocumentsIn({
      repositoryRoot,
      places: normativeDocumentPlacesIn(repositoryRoot),
      workspaceDirectories: workspaces.map((workspace) => workspace.workspaceDir),
    });
    if (normativeDocuments.length === 0) {
      const strandedText = yield* textOrNull(path.join(repositoryRoot, GUIDELINE_INDEX_PATH));
      return {
        problems:
          strandedText === null
            ? []
            : [{ file: GUIDELINE_INDEX_PATH, message: strandedIndex(GUIDELINE_INDEX_PATH) }],
        scanned: 0,
      };
    }

    return {
      problems: yield* generatedFileProblems({
        repositoryRoot,
        file: GUIDELINE_INDEX_PATH,
        begin: BEGIN_MARKER,
        end: END_MARKER,
        expected: renderGuidelineIndex({ normativeDocuments, grounded }),
        scaffold: scaffoldOf,
        absent: missingIndex,
        stale: staleIndex,
        write,
      }),
      scanned: normativeDocuments.length,
    };
  });
