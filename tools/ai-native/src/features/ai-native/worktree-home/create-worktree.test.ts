import { describe, expect, test } from "vite-plus/test";

import { joinPath } from "../host.ts";
import { createWorktree } from "./create-worktree.ts";
import { gitOutput, runGit } from "./git.ts";

const nodeFs = process.getBuiltinModule("fs") as {
  readonly mkdtempSync: (prefix: string) => string;
};
const nodeOs = process.getBuiltinModule("os") as {
  readonly tmpdir: () => string;
};

const originAddress = "https://git.example.test/acme/widgets.git";

describe("createWorktree", () => {
  describe("a repository whose origin is known", () => {
    const it = test
      .extend("theCheckout", () => {
        const theSandbox = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "worktree-home-"));
        const origin = joinPath(theSandbox, "origin.git");
        const checkout = joinPath(theSandbox, "checkout");
        for (const gitStep of [
          { cwd: theSandbox, handed: ["init", "--quiet", "--bare", "-b", "main", origin] },
          { cwd: theSandbox, handed: ["init", "--quiet", "-b", "main", checkout] },
          { cwd: checkout, handed: ["config", `url.${origin}.insteadOf`, originAddress] },
          { cwd: checkout, handed: ["remote", "add", "origin", originAddress] },
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
          { cwd: checkout, handed: ["push", "--quiet", "origin", "main"] },
        ]) {
          gitOutput(runGit, gitStep);
        }
        return checkout;
      })
      .extend("theWorktree", ({ theCheckout }) =>
        createWorktree({
          cwd: theCheckout,
          home: nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "worktree-home-home-")),
          name: "claude/fix-login",
        }),
      )
      .extend("theWorktreeUnderHome", ({ theWorktree }) =>
        theWorktree.slice(theWorktree.indexOf("/worktrees/")),
      )
      .extend("theBranchOfTheWorktree", ({ theWorktree }) =>
        gitOutput(runGit, { cwd: theWorktree, handed: ["rev-parse", "--abbrev-ref", "HEAD"] }),
      )
      .extend("theWorktreeHead", ({ theWorktree }) =>
        gitOutput(runGit, { cwd: theWorktree, handed: ["rev-parse", "HEAD"] }),
      )
      .extend("theOriginHead", ({ theCheckout }) =>
        gitOutput(runGit, { cwd: theCheckout, handed: ["rev-parse", "origin/main"] }),
      );

    it("creates the worktree under the home worktrees directory in the gwq layout", ({
      theWorktreeUnderHome,
    }) => {
      expect(theWorktreeUnderHome).toBe(
        "/worktrees/git.example.test/acme/widgets/claude/fix-login",
      );
    });

    it("checks out a new branch named after the worktree", ({ theBranchOfTheWorktree }) => {
      expect(theBranchOfTheWorktree).toBe("claude/fix-login");
    });

    it("branches from the latest default branch of origin", ({
      theOriginHead,
      theWorktreeHead,
    }) => {
      expect(theWorktreeHead).toBe(theOriginHead);
    });
  });

  describe("a directory outside any repository", () => {
    const it = test
      .extend("theSandbox", () => nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "worktree-home-")))
      .extend("theFailure", ({ theSandbox }) => {
        try {
          createWorktree({ cwd: theSandbox, home: theSandbox, name: "stray" });
        } catch (failure) {
          return failure;
        }
        throw new Error("createWorktree accepted a directory outside any repository");
      });

    it("fails instead of creating a worktree", ({ theFailure, theSandbox }) => {
      expect(theFailure).toStrictEqual(
        new Error(`worktree-home: ${theSandbox} is not inside a git repository`),
      );
    });
  });
});
