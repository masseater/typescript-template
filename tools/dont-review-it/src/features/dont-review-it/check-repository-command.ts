import { resolve } from "node:path";

import { defineCommand } from "citty";

import { refuseMisuse, repairGeneratedParts, reportProblems } from "./check-support.ts";
import { runLintRuleAuthoring } from "./lint-rule-authoring/run-cli.ts";
import { isDirectory } from "./lint/oxlint/lib/canonical-values/source-files.ts";
import {
  EXIT_MISUSE,
  EXIT_SUCCESS,
  measureCheck,
  type CliResult,
} from "./repository-checks/index.ts";
import { runStopAiSlop } from "./stop-ai-slop/run-cli.ts";

const writeCliResult = (result: CliResult): number => {
  if (result.out !== "") process.stdout.write(result.out);
  if (result.error !== "") process.stderr.write(result.error);
  return result.exitCode;
};

export const checkRepositoryCommand = defineCommand({
  meta: {
    name: "check-repository",
    description: "Run every repository gate check from this workspace.",
  },
  args: {
    "repository-root": {
      type: "string",
      description: "Root of the repository to scan (defaults to the current working directory)",
      valueHint: "path",
    },
    write: {
      type: "boolean",
      default: false,
      description: "Rewrite generated parts owned by dont-review-it, then run every check",
    },
  },
  async run({ args }) {
    await measureCheck(async () => {
      const repositoryRoot = resolve(args["repository-root"] ?? process.cwd());
      if (!isDirectory(repositoryRoot)) {
        refuseMisuse(`${repositoryRoot} is not a directory that can be scanned.\n`);
        return;
      }

      if (args.write && !repairGeneratedParts(repositoryRoot)) return;

      process.exitCode = EXIT_SUCCESS;
      reportProblems(repositoryRoot);
      const afterDontReviewIt = process.exitCode ?? EXIT_SUCCESS;
      if (afterDontReviewIt === EXIT_MISUSE) return;

      const rootArgs = ["--repository-root", repositoryRoot];
      const exits = [
        afterDontReviewIt,
        writeCliResult(runLintRuleAuthoring(["check", ...rootArgs])),
        writeCliResult(await runStopAiSlop(["check", ...rootArgs])),
      ];
      const worst = Math.max(...exits);
      if (worst !== EXIT_SUCCESS) process.exitCode = worst;
    });
  },
});
