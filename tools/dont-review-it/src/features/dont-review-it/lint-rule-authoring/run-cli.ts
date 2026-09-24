import { Effect, type FileSystem } from "effect";

import { isDirectoryAt } from "../platform/file-system.ts";
import { path } from "../platform/path.ts";
import {
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  misuseOf,
  type CliResult,
} from "../repository-checks/index.ts";
import { formatLintRuleProblem } from "./lint-rule-problem.ts";
import { lintRuleDocProblems } from "./rule-docs/reconcile-rule-doc.ts";
import { guidelineIndexProblems } from "./rule-index/reconcile-guideline-index.ts";
import { lintRuleIndexProblems } from "./rule-index/reconcile-rule-index.ts";
import { relatedGuidelineProblems } from "./rule-index/related-guidelines.ts";

interface LintRuleAuthoringCheck {
  readonly repositoryRoot: string;
  readonly write: boolean;
}

const check = (request: LintRuleAuthoringCheck) =>
  Effect.gen(function* check() {
    const repositoryRoot = path.resolve(request.repositoryRoot);
    if (!(yield* isDirectoryAt(repositoryRoot))) {
      return {
        exitCode: EXIT_MISUSE,
        out: "",
        error: `${repositoryRoot} is not a directory that can be scanned.\n`,
      };
    }

    const { write } = request;
    const index = yield* lintRuleIndexProblems({ repositoryRoot, write });
    const docs = yield* lintRuleDocProblems({ repositoryRoot, write });
    const grounds = yield* relatedGuidelineProblems({ repositoryRoot });
    const guidelineIndex = yield* guidelineIndexProblems({ repositoryRoot, write });
    const problems = [
      ...index.problems,
      ...docs.problems,
      ...grounds.problems,
      ...guidelineIndex.problems,
    ];
    return {
      exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
      out: problems.map((problem) => `${formatLintRuleProblem(problem)}\n`).join(""),
      error: "",
    };
  });

export const runLintRuleAuthoring = (
  request: LintRuleAuthoringCheck,
): Effect.Effect<CliResult, never, FileSystem.FileSystem> =>
  check(request).pipe(Effect.catch((failure) => Effect.succeed(misuseOf(failure))));
export type { LintRuleAuthoringCheck };
