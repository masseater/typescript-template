import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { generatedSourcePaths } from "../lint/oxlint/lib/generated-source.ts";
import { gitOutput } from "../lint/oxlint/lib/git-output.ts";
import { generatedFiles } from "./lint.ts";
import { repositoryRoot } from "./repository-root.ts";

const generatedAttribute = "linguist-generated";

const byText = (left: string, right: string): number => left.localeCompare(right);

const listedPaths = (gitArguments: readonly string[]): readonly string[] =>
  (gitOutput(gitArguments, { cwd: repositoryRoot, env: process.env }) ?? "")
    .split("\0")
    .filter((listedPath) => listedPath !== "");

const trackedPaths = listedPaths(["ls-files", "-z"]);

const globbedPaths = listedPaths([
  "ls-files",
  "-z",
  "--",
  ...generatedFiles.map((generatedGlob) => `:(glob)${generatedGlob}`),
]);

const attributedPaths = [...generatedSourcePaths({ repositoryRoot, relativePaths: trackedPaths })];

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
    pattern !== undefined &&
    pattern !== "" &&
    attributes.some((attribute) => attribute.replace(/^[-!]/u, "").startsWith(generatedAttribute))
      ? [pattern]
      : [],
  );

describe("generated files", () => {
  it("are every tracked file git marks generated and no other", () => {
    expect.hasAssertions();
    expect(globbedPaths.length).toBeGreaterThan(0);
    expect(attributedPaths.toSorted(byText)).toStrictEqual(globbedPaths.toSorted(byText));
  });

  it("are marked in the root attributes file by exactly the globs the linter and formatter skip", () => {
    expect.hasAssertions();
    expect(attributedPatterns.toSorted(byText)).toStrictEqual(generatedFiles.toSorted(byText));
  });
});
