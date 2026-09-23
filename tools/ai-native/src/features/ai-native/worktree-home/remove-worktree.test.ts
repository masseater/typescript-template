import { describe, expect, test } from "vite-plus/test";

import { fileExists, joinPath, parentPath, writeFileString } from "../host.ts";
import { gitOutput, runGit } from "./git.ts";
import { removeWorktree } from "./remove-worktree.ts";

const nodeFs = process.getBuiltinModule("fs") as {
  readonly mkdtempSync: (prefix: string) => string;
};
const nodeOs = process.getBuiltinModule("os") as {
  readonly tmpdir: () => string;
};

describe("removeWorktree", () => {
  const it = test
    .extend("theCheckout", () => {
      const sandbox = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "worktree-home-"));
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
        gitOutput(runGit, gitStep);
      }
      writeFileString({ location: joinPath(sandbox, "dirty", "draft.txt"), written: "draft\n" });
      return checkout;
    })
    .extend("theCleanWorktreeLeft", ({ theCheckout }) => {
      const cleanWorktree = joinPath(parentPath(theCheckout), "clean");
      removeWorktree(cleanWorktree);
      return fileExists(cleanWorktree);
    })
    .extend("theDirtyRemovalFailure", ({ theCheckout }) => {
      try {
        removeWorktree(joinPath(parentPath(theCheckout), "dirty"));
      } catch (failure) {
        return failure;
      }
      throw new Error("removeWorktree removed a worktree with uncommitted work");
    })
    .extend(
      "theDraftKeptAfterRefusal",
      ({ theCheckout, theDirtyRemovalFailure }) =>
        theDirtyRemovalFailure instanceof Error &&
        fileExists(joinPath(parentPath(theCheckout), "dirty", "draft.txt")),
    );

  it("removes a clean worktree directory", ({ theCleanWorktreeLeft }) => {
    expect(theCleanWorktreeLeft).toBe(false);
  });

  it("fails on uncommitted work and keeps it on disk", ({ theDraftKeptAfterRefusal }) => {
    expect(theDraftKeptAfterRefusal).toBe(true);
  });
});
