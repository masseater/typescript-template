import { chunk } from "es-toolkit";

import { gitOutput } from "./git-output.ts";

const GENERATED_ATTRIBUTE = "linguist-generated";

const GENERATED_STATES: ReadonlySet<string> = new Set(["set", "true"]);

const CHECK_ATTR_FIELD_COUNT = 3;

export const generatedSourcePaths = ({
  repositoryRoot,
  relativePaths,
}: {
  readonly repositoryRoot: string;
  readonly relativePaths: readonly string[];
}): ReadonlySet<string> => {
  if (relativePaths.length === 0) return new Set();

  const answer = gitOutput(["check-attr", "-z", "--stdin", GENERATED_ATTRIBUTE], {
    cwd: repositoryRoot,
    env: process.env,
    input: relativePaths.join("\0"),
  });
  if (answer === null) return new Set();

  return new Set(
    chunk(answer.split("\0"), CHECK_ATTR_FIELD_COUNT).flatMap(([sourcePath, , state]) =>
      sourcePath !== undefined && state !== undefined && GENERATED_STATES.has(state)
        ? [sourcePath]
        : [],
    ),
  );
};
