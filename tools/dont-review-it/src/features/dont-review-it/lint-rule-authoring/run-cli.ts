import { parseArgs } from "node:util";

import { Effect, type FileSystem, Schema } from "effect";

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

const USAGE = `Usage: lint-rule-authoring check [--write] [--repository-root <path>]

Reconciles every workspace lint rule index (docs/lint/index.md), every rule
document (docs/lint/<rule>.md), and the repository table of rules by normative
document (docs/lint-rules-by-guideline.md) with the rule implementations found
under the directories that the workspace manifests declare in their lintRules
field. Also reports every rule that names no normative document as its grounds,
or names one that is not there. Without --write it only reports what is missing,
unmarked, stale, or still carrying the text a seeded document was written with;
with --write it seeds the absent documents and regenerates every generated
region. Exits non-zero when a problem remains.

Options:
  --write                   Write the regenerated documents instead of only reporting them.
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
`;

class CommandLineRefused extends Schema.TaggedError<CommandLineRefused>()("CommandLineRefused", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return this.cause instanceof Error ? this.cause.message : String(this.cause);
  }
}

const dispatch = (argv: readonly string[]) =>
  Effect.gen(function* dispatch() {
    const parsedNode = yield* Effect.try({
      try: () =>
        parseArgs({
          args: [...argv],
          allowPositionals: true,
          options: { "repository-root": { type: "string" }, write: { type: "boolean" } },
        }),
      catch: (refusal) => new CommandLineRefused({ cause: refusal }),
    });
    const [command] = parsedNode.positionals;
    if (command !== "check") {
      return { exitCode: EXIT_MISUSE, out: "", error: USAGE };
    }

    const repositoryRoot = path.resolve(parsedNode.values["repository-root"] ?? process.cwd());
    if (!(yield* isDirectoryAt(repositoryRoot))) {
      return {
        exitCode: EXIT_MISUSE,
        out: "",
        error: `${repositoryRoot} is not a directory that can be scanned.\n`,
      };
    }

    const write = parsedNode.values.write ?? false;
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
  argv: readonly string[],
): Effect.Effect<CliResult, never, FileSystem.FileSystem> =>
  dispatch(argv).pipe(Effect.catch((failure) => Effect.succeed(misuseOf(failure))));
