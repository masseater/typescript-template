import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { fileExists, filesystem, joinPath, parentPath, writeFileString } from "../host.ts";
import { gitOutput, runGit } from "./git.ts";
import { removeWorktree } from "./remove-worktree.ts";

describe("removeWorktree", () => {
  const it = test
    .extend("theCheckout", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const sandbox = yield* filesystem.makeTempDirectory({ prefix: "worktree-home-" });
          const checkout = joinPath(sandbox, "checkout");
          for (const gitStep of [
            { cwd: sandbox, handed: ["init", "--quiet", "-b", "main", checkout] },
            {
              cwd: checkout,
              handed: [
                "-c",
                "user.email=f@example.test",
                "-c",
                "user.name=f",
                "commit",
                "--quiet",
                "--allow-empty",
                "-m",
                "initial",
              ],
            },
            { cwd: checkout, handed: ["worktree", "add", "--quiet", "-b", "clean", "../clean"] },
            { cwd: checkout, handed: ["worktree", "add", "--quiet", "-b", "dirty", "../dirty"] },
          ]) {
            yield* gitOutput(runGit, gitStep);
          }
          yield* writeFileString({
            location: joinPath(sandbox, "dirty", "draft.txt"),
            written: "draft\n",
          });
          return checkout;
        }),
      ))
    .extend("theCleanWorktreeLeft", ({ theCheckout }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const cleanWorktree = joinPath(parentPath(theCheckout), "clean");
          yield* removeWorktree(cleanWorktree);
          return yield* fileExists(cleanWorktree);
        }),
      ),
    )
    .extend("theDirtyRemovalFailure", ({ theCheckout }) =>
      Effect.runPromise(
        removeWorktree(joinPath(parentPath(theCheckout), "dirty")).pipe(
          Effect.flip,
          Effect.orElseSucceed(() => {
            throw new Error("removeWorktree removed a worktree with uncommitted work");
          }),
        ),
      ),
    )
    .extend("theDraftKeptAfterRefusal", ({ theCheckout, theDirtyRemovalFailure }) =>
      Effect.runPromise(
        fileExists(joinPath(parentPath(theCheckout), "dirty", "draft.txt")).pipe(
          Effect.map((draftKept) => theDirtyRemovalFailure instanceof Error && draftKept),
        ),
      ),
    );

  it("removes a clean worktree directory", ({ theCleanWorktreeLeft }) => {
    expect(theCleanWorktreeLeft).toBe(false);
  });

  it("fails on uncommitted work and keeps it on disk", ({ theDraftKeptAfterRefusal }) => {
    expect(theDraftKeptAfterRefusal).toBe(true);
  });
});
