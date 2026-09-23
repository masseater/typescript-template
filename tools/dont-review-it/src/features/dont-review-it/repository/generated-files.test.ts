import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { generatedFiles } from "./lint.ts";
import { repositoryRoot } from "./repository-root.ts";

const generatedAttribute = "linguist-generated";

const byText = (left: string, right: string): number => left.localeCompare(right);

const attributeLines = await Effect.runPromise(
  Effect.gen(function* gitAttributes() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    return yield* filesystem.readFileString(paths.join(repositoryRoot, ".gitattributes"));
  }).pipe(Effect.provide(NodeServices.layer)),
);

const attributedPatterns = attributeLines
  .split("\n")
  .map((line) => line.trim().split(/\s+/u))
  .flatMap(([pattern, ...attributes]) =>
    pattern !== undefined && pattern !== "" && attributes.includes(generatedAttribute)
      ? [pattern]
      : [],
  );

describe("generated files", () => {
  it("are marked for git exactly where the linter and formatter skip them", () => {
    expect.hasAssertions();
    expect(attributedPatterns.toSorted(byText)).toStrictEqual(generatedFiles.toSorted(byText));
  });
});
