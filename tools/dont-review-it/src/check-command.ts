import { resolve } from "node:path";

import { measureCheck } from "@repo/dont-review-it/repository-checks";
import { defineCommand } from "citty";

import { refuseMisuse, repairGeneratedParts, reportProblems } from "./check-support.ts";
import { isDirectory } from "./lint/oxlint/lib/canonical-values/source-files.ts";

const REPOSITORY_ROOT_FLAG = "--repository-root";

const WRITE_FLAG = "--write";

const KNOWN_FLAGS = [REPOSITORY_ROOT_FLAG, WRITE_FLAG];

const flagsIn = (commandLine: readonly string[]): readonly string[] =>
  commandLine.filter((token) => token.startsWith("-")).map((token) => token.replace(/=.*$/u, ""));

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description: "Report every discipline violation the lint toolchain cannot see.",
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
      description:
        "Rewrite the parts this repository decides on its own, entry scripts and shipped skill versions, then re-run the checks",
    },
  },
  async run({ args, rawArgs }) {
    await measureCheck(() => {
      const unknownFlags = flagsIn(rawArgs).filter((raised) => !KNOWN_FLAGS.includes(raised));
      if (unknownFlags.length > 0) {
        refuseMisuse(`Unknown option ${unknownFlags.join(", ")}. Run --help for usage.\n`);
        return;
      }

      const repositoryRoot = resolve(args["repository-root"] ?? process.cwd());
      if (!isDirectory(repositoryRoot)) {
        refuseMisuse(`${repositoryRoot} is not a directory that can be scanned.\n`);
        return;
      }

      if (args.write && !repairGeneratedParts(repositoryRoot)) return;

      reportProblems(repositoryRoot);
    });
  },
});
