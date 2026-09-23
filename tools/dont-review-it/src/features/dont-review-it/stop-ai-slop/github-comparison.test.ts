import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { compareGitHubPullRequest } from "./github-comparison.ts";
import { GitHubRequestFailed, type GitHubApi } from "./github-request.ts";
import { UndecodableSource } from "./repository-comparison.ts";

type Compared = Effect.Success<ReturnType<GitHubApi["compare"]>>;

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

const apiAnswering = (
  compared: Compared,
  writtenContents: Readonly<Record<string, Uint8Array>>,
): GitHubApi => ({
  compare: () => Effect.succeed(compared),
  contents: (repository, { sourcePath, revision }) => {
    const written = writtenContents[`${repository}/${sourcePath}@${revision}`];
    return written === undefined
      ? Effect.fail(
          new GitHubRequestFailed({ message: `no contents for ${sourcePath}@${revision}` }),
        )
      : Effect.succeed(written);
  },
});

const pullRequestComparedThrough = (api: GitHubApi) =>
  compareGitHubPullRequest({
    repositoryRoot: "/checkout",
    repository: "owner/name",
    baseRevision: "basetip",
    headRevision: "headsha",
    api,
  });

describe("compareGitHubPullRequest", () => {
  describe("a pull request whose sides are only reachable through the API", () => {
    const apiSideComparison = Effect.suspend(() => {
      const before = "export const current = true;\nexport const legacyMode = true;\n";
      const after = "export const current = true;\n";
      return pullRequestComparedThrough(
        apiAnswering(
          {
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
          },
          {
            "owner/name/src/legacy.ts@basesha": utf8(before),
            "owner/name/src/legacy.ts@headsha": utf8(after),
            "owner/name/src/legacy-api.test.ts@headsha": utf8("const added = true;\n"),
          },
        ),
      );
    });

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
              beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
              afterSource: "export const current = true;\n",
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
      apiAnswering(
        {
          merge_base_commit: { sha: "basesha" },
          files: [
            {
              filename: "src/legacy.ts",
              status: "modified",
              patch: "@@ -1,2 +1,1 @@\n-export const legacyMode = true;\n",
            },
          ],
        },
        {
          "owner/name/src/legacy.ts@basesha": Uint8Array.from([0xff, 0xfe, 0xff]),
          "owner/name/src/legacy.ts@headsha": utf8("export const current = true;\n"),
        },
      ),
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
              afterSource: "export const current = true;\n",
              addedLines: [],
              firstAddedLine: null,
            },
          ],
        });
      }),
    );
  });

  describe("a pull request whose head source the API answered as undecodable bytes", () => {
    const failureFromReadingAnUndecodableHeadSource = Effect.flip(
      pullRequestComparedThrough(
        apiAnswering(
          {
            merge_base_commit: { sha: "basesha" },
            files: [
              {
                filename: "src/legacy.ts",
                status: "modified",
                patch: "@@ -1,2 +1,1 @@\n-export const legacyMode = true;\n",
              },
            ],
          },
          {
            "owner/name/src/legacy.ts@basesha": utf8("export const legacyMode = true;\n"),
            "owner/name/src/legacy.ts@headsha": Uint8Array.from([0xff, 0xfe, 0xff]),
          },
        ),
      ),
    );

    it.effect("refuses a head source the API answered as undecodable bytes", () =>
      Effect.gen(function* program() {
        expect(yield* failureFromReadingAnUndecodableHeadSource).toStrictEqual(
          new UndecodableSource({
            message: "Source blob does not decode as UTF-8: src/legacy.ts",
            cause: expect.any(TypeError),
          }),
        );
      }),
    );
  });

  describe("a pull request whose source the contents API refused", () => {
    const failureFromARefusedSource = Effect.flip(
      pullRequestComparedThrough(
        apiAnswering(
          {
            merge_base_commit: { sha: "basesha" },
            files: [
              {
                filename: "src/added.ts",
                status: "added",
                patch: "@@ -0,0 +1,1 @@\n+export const added = true;\n",
              },
            ],
          },
          {},
        ),
      ),
    );

    it.effect("fails with the refusal the contents API answered", () =>
      Effect.gen(function* program() {
        expect(yield* failureFromARefusedSource).toStrictEqual(
          new GitHubRequestFailed({ message: "no contents for src/added.ts@headsha" }),
        );
      }),
    );
  });

  describe("a compare reporting a removal, a rename and a copy", () => {
    const movedFilesComparison = Effect.suspend(() => {
      const kept = utf8("export const kept = true;\n");
      return pullRequestComparedThrough(
        apiAnswering(
          {
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
              { filename: "src/copy.ts", status: "copied" },
            ],
          },
          {
            "owner/name/src/gone.ts@basesha": kept,
            "owner/name/src/was-here.ts@basesha": kept,
            "owner/name/src/moved.ts@headsha": kept,
            "owner/name/src/copy.ts@headsha": kept,
          },
        ),
      );
    });

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

  describe("a pull request that changed nothing", () => {
    const emptyComparison = pullRequestComparedThrough(
      apiAnswering({ merge_base_commit: { sha: "basesha" } }, {}),
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
