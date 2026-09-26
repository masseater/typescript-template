import * as NodeServices from "@effect/platform-node/NodeServices";
import { defineCommand } from "citty";
import { Effect } from "effect";

import { refuseMisuse, repairGeneratedParts, reportProblems } from "./check-support.ts";
import { isDirectoryAt } from "./platform/file-system.ts";
import { path } from "./platform/path.ts";
import { measureCheck } from "./repository-checks/index.ts";

const REPOSITORY_ROOT_FLAG = "--repository-root";

const KNOWN_FLAGS = [REPOSITORY_ROOT_FLAG];

const flagsIn = (commandLine: readonly string[]): readonly string[] =>
  commandLine.filter((token) => token.startsWith("-")).map((token) => token.replace(/=.*$/u, ""));

const scanCommand = (input: {
  readonly name: string;
  readonly description: string;
  readonly regenerateFirst: boolean;
}) =>
  defineCommand({
    meta: { name: input.name, description: input.description },
    args: {
      "repository-root": {
        type: "string",
        description: "Root of the repository to scan (defaults to the current working directory)",
        valueHint: "path",
      },
    },
    run({ args, rawArgs }) {
      return measureCheck(() =>
        Effect.runPromise(
          Effect.gen(function* check() {
            const unknownFlags = flagsIn(rawArgs).filter(
              (raised) => !KNOWN_FLAGS.includes(raised),
            );
            if (unknownFlags.length > 0) {
              refuseMisuse(`Unknown option ${unknownFlags.join(", ")}. Run --help for usage.\n`);
              return;
            }

            const repositoryRoot = path.resolve(args["repository-root"] ?? process.cwd());
            if (!(yield* isDirectoryAt(repositoryRoot))) {
              refuseMisuse(`${repositoryRoot} is not a directory that can be scanned.\n`);
              return;
            }

            if (input.regenerateFirst && !(yield* repairGeneratedParts(repositoryRoot))) return;

            yield* reportProblems(repositoryRoot);
          }).pipe(Effect.provide(NodeServices.layer)),
        ),
      );
    },
  });

export const checkCommand = scanCommand({
  name: "check",
  description: "Report every discipline violation the lint toolchain cannot see.",
  regenerateFirst: false,
});

export const regenerateCommand = scanCommand({
  name: "regenerate",
  description:
    "Rewrite the parts this repository decides on its own, entry scripts, shipped skill versions and lint rule documents, then report what is left.",
  regenerateFirst: true,
});
