import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import {
  compareGitHubPullRequest,
  GitHubRequestFailed,
  type GitHubRequest,
} from "./github-comparison.ts";
import { ParsingRefused } from "./parsing-refused.ts";

const LEGACY_BEFORE = "export const current = true;\nexport const legacyMode = true;\n";

const LEGACY_AFTER = "export const current = true;\n";

const LEGACY_COMPARE = {
  merge_base_commit: { sha: "basesha" },
  files: [
    {
      filename: "src/legacy.ts",
      status: "modified",
      patch: "@@ -1,2 +1,1 @@\n-export const legacyMode = true;\n",
    },
    {
      filename: "src/legacy-api.test.ts",
      status: "added",
      patch: '@@ -0,0 +1,1 @@\n+expect(legacy).not.toHaveProperty("legacyMode");\n',
    },
  ],
};

const answeringWith =
  (compared: unknown, writtenContents: Readonly<Record<string, Uint8Array>>): GitHubRequest =>
  (requestPath) => {
    if (requestPath.startsWith("/repos/owner/name/compare/")) return Effect.succeed(compared);
    const writtenContent = writtenContents[requestPath];
    return writtenContent === undefined
      ? Effect.fail(new GitHubRequestFailed({ message: `unexpected request ${requestPath}` }))
      : Effect.succeed({ content: Buffer.from(writtenContent).toString("base64") });
  };

const pullRequestComparedThrough = (request: GitHubRequest) =>
  compareGitHubPullRequest({
    repositoryRoot: "/checkout",
    repository: "owner/name",
    baseRevision: "basetip",
    headRevision: "headsha",
    request,
  });

const refusalThrough = (request: GitHubRequest) =>
  Effect.map(Effect.flip(pullRequestComparedThrough(request)), (failure) => failure.message);

describe("compareGitHubPullRequest", () => {
  describe("a pull request whose sides are only reachable through the API", () => {
    const apiSideComparison = pullRequestComparedThrough(
      answeringWith(LEGACY_COMPARE, {
        "/repos/owner/name/contents/src/legacy.ts?ref=basesha": Buffer.from(LEGACY_BEFORE, "utf8"),
        "/repos/owner/name/contents/src/legacy.ts?ref=headsha": Buffer.from(LEGACY_AFTER, "utf8"),
        "/repos/owner/name/contents/src/legacy-api.test.ts?ref=headsha": Buffer.from(
          "const added = true;\n",
          "utf8",
        ),
      }),
    );

    it.effect("reads the compared sides through the API instead of the local repository", () =>
      Effect.gen(function* program() {
        expect(yield* apiSideComparison).toStrictEqual({
          repositoryRoot: "/checkout",
          baseRevision: "basesha",
          headRevision: "headsha",
          files: [
            {
              kind: "changed",
              beforePath: "src/legacy.ts",
              afterPath: "src/legacy.ts",
              beforeSource: LEGACY_BEFORE,
              afterSource: LEGACY_AFTER,
              addedLines: [],
              firstAddedLine: null,
            },
            {
              kind: "added",
              beforePath: null,
              afterPath: "src/legacy-api.test.ts",
              beforeSource: null,
              afterSource: "const added = true;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
          ],
        });
      }),
    );
  });

  describe("a pull request whose previous source the API answered as undecodable bytes", () => {
    const undecodablePreviousSourceComparison = pullRequestComparedThrough(
      answeringWith(LEGACY_COMPARE, {
        "/repos/owner/name/contents/src/legacy.ts?ref=basesha": Uint8Array.from([0xff, 0xfe, 0xff]),
        "/repos/owner/name/contents/src/legacy.ts?ref=headsha": Buffer.from(LEGACY_AFTER, "utf8"),
        "/repos/owner/name/contents/src/legacy-api.test.ts?ref=headsha": Buffer.from(
          "const added = true;\n",
          "utf8",
        ),
      }),
    );

    it.effect("compares a previous source the API answered as undecodable bytes as no source", () =>
      Effect.gen(function* program() {
        expect(yield* undecodablePreviousSourceComparison).toStrictEqual({
          repositoryRoot: "/checkout",
          baseRevision: "basesha",
          headRevision: "headsha",
          files: [
            {
              kind: "changed",
              beforePath: "src/legacy.ts",
              afterPath: "src/legacy.ts",
              beforeSource: null,
              afterSource: LEGACY_AFTER,
              addedLines: [],
              firstAddedLine: null,
            },
            {
              kind: "added",
              beforePath: null,
              afterPath: "src/legacy-api.test.ts",
              beforeSource: null,
              afterSource: "const added = true;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
          ],
        });
      }),
    );
  });

  describe("a pull request whose head source the API answered as undecodable bytes", () => {
    const failureFromReadingAnUndecodableHeadSource = refusalThrough(
      answeringWith(LEGACY_COMPARE, {
        "/repos/owner/name/contents/src/legacy.ts?ref=basesha": Buffer.from(LEGACY_BEFORE, "utf8"),
        "/repos/owner/name/contents/src/legacy.ts?ref=headsha": Uint8Array.from([0xff, 0xfe, 0xff]),
        "/repos/owner/name/contents/src/legacy-api.test.ts?ref=headsha": Buffer.from(
          "const added = true;\n",
          "utf8",
        ),
      }),
    );

    it.effect("refuses a head source the API answered as undecodable bytes", () =>
      Effect.gen(function* program() {
        expect(yield* failureFromReadingAnUndecodableHeadSource).toBe(
          "Source blob does not decode as UTF-8: src/legacy.ts",
        );
      }),
    );
  });

  describe("a compare reporting a removal, a rename and a copy", () => {
    const movedFilesComparison = pullRequestComparedThrough((requestPath) =>
      Effect.succeed(
        requestPath.startsWith("/repos/owner/name/compare/")
          ? {
              merge_base_commit: { sha: "basesha" },
              files: [
                {
                  filename: "src/gone.ts",
                  status: "removed",
                  patch: "@@ -1,1 +0,0 @@\n-export const gone = true;\n",
                },
                {
                  filename: "src/moved.ts",
                  status: "renamed",
                  previous_filename: "src/was-here.ts",
                },
                {
                  filename: "src/copy.ts",
                  status: "copied",
                  previous_filename: "src/original.ts",
                },
              ],
            }
          : {
              content: Buffer.from("export const kept = true;\n", "utf8").toString("base64"),
            },
      ),
    );

    it.effect("reads a removal, a rename and a copy the compare reported", () =>
      Effect.gen(function* program() {
        expect(yield* movedFilesComparison).toStrictEqual({
          repositoryRoot: "/checkout",
          baseRevision: "basesha",
          headRevision: "headsha",
          files: [
            {
              kind: "deleted",
              beforePath: "src/gone.ts",
              afterPath: null,
              beforeSource: "export const kept = true;\n",
              afterSource: null,
              addedLines: [],
              firstAddedLine: null,
            },
            {
              kind: "renamed",
              beforePath: "src/was-here.ts",
              afterPath: "src/moved.ts",
              beforeSource: "export const kept = true;\n",
              afterSource: "export const kept = true;\n",
              addedLines: [],
              firstAddedLine: null,
            },
            {
              kind: "added",
              beforePath: null,
              afterPath: "src/copy.ts",
              beforeSource: null,
              afterSource: "export const kept = true;\n",
              addedLines: [],
              firstAddedLine: null,
            },
          ],
        });
      }),
    );
  });

  describe("a compare status that maps to no change", () => {
    const failureFromReadingAnUnknownStatus = refusalThrough(() =>
      Effect.succeed({
        merge_base_commit: { sha: "basesha" },
        files: [{ filename: "src/legacy.ts", status: "unchanged" }],
      }),
    );

    it.effect("refuses a compare status it cannot map to a change", () =>
      Effect.gen(function* program() {
        expect(yield* failureFromReadingAnUnknownStatus).toBe(
          'Do not read past an unknown compare status "unchanged".',
        );
      }),
    );

    it.effect("names an unreadable compare as the failure", () =>
      Effect.gen(function* program() {
        expect(
          yield* Effect.flip(
            pullRequestComparedThrough(() =>
              Effect.succeed({
                merge_base_commit: { sha: "basesha" },
                files: [{ filename: "src/legacy.ts", status: "unchanged" }],
              }),
            ),
          ),
        ).toBeInstanceOf(ParsingRefused);
      }),
    );
  });

  describe("a renamed file the compare answered without its former path", () => {
    const failureFromReadingARenameWithoutItsFormerPath = refusalThrough(() =>
      Effect.succeed({
        merge_base_commit: { sha: "basesha" },
        files: [{ filename: "docs/moved.md", status: "renamed", previous_filename: "" }],
      }),
    );

    it.effect("refuses a renamed file the compare answered without its former path", () =>
      Effect.gen(function* program() {
        expect(yield* failureFromReadingARenameWithoutItsFormerPath).toBe(
          "Do not read a move the compare answered without its former path: docs/moved.md.",
        );
      }),
    );
  });

  describe("a file the contents API answered without content", () => {
    const failureFromReadingAFileWithoutContent = refusalThrough((requestPath) =>
      Effect.succeed(
        requestPath.startsWith("/repos/owner/name/compare/")
          ? {
              merge_base_commit: { sha: "basesha" },
              files: [
                {
                  filename: "src/added.ts",
                  status: "added",
                  patch: "@@ -0,0 +1,1 @@\n+const added = true;\n",
                },
              ],
            }
          : {},
      ),
    );

    it.effect("refuses a file the contents API answered without content", () =>
      Effect.gen(function* program() {
        expect(yield* failureFromReadingAFileWithoutContent).toBe(
          "Do not read a file the contents API answered without content.",
        );
      }),
    );
  });

  describe("a compare the API answered as something other than an object", () => {
    const failureFromReadingACompareThatIsNotAnObject = refusalThrough(() =>
      Effect.succeed("no compare here"),
    );

    it.effect("refuses a compare the API answered as something other than an object", () =>
      Effect.gen(function* program() {
        expect(yield* failureFromReadingACompareThatIsNotAnObject).toBe(
          "Do not read a compare the API answered as something other than an object.",
        );
      }),
    );
  });

  describe("a compare that answered its changed files as something other than a list", () => {
    const failureFromReadingChangedFilesThatAreNotAList = refusalThrough(() =>
      Effect.succeed({
        merge_base_commit: { sha: "basesha" },
        files: { "src/legacy.ts": "modified" },
      }),
    );

    it.effect("refuses changed files the compare answered as something other than a list", () =>
      Effect.gen(function* program() {
        expect(yield* failureFromReadingChangedFilesThatAreNotAList).toBe(
          "Do not read the changed files the compare answered as something other than a list.",
        );
      }),
    );
  });

  describe("a pull request that changed nothing", () => {
    const emptyComparison = pullRequestComparedThrough(() =>
      Effect.succeed({ merge_base_commit: { sha: "basesha" } }),
    );

    it.effect("compares nothing when the pull request changed nothing", () =>
      Effect.gen(function* program() {
        expect(yield* emptyComparison).toStrictEqual({
          repositoryRoot: "/checkout",
          baseRevision: "basesha",
          headRevision: "headsha",
          files: [],
        });
      }),
    );
  });
});
