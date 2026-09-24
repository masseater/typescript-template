import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { filesystem, paths } from "../host.ts";
import { createWorktree } from "./create-worktree.ts";
import { gitOutput, runGit, WorktreeHomeFailure } from "./git.ts";

const originAddress = "https://git.example.test/acme/widgets.git";

describe("createWorktree", () => {
  describe("a repository whose origin is known", () => {
    const it = test
      .extend("theCheckout", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const theSandbox = yield* filesystem.makeTempDirectory({ prefix: "worktree-home-" });
            const origin = paths.join(theSandbox, "origin.git");
            const checkout = paths.join(theSandbox, "checkout");
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
              yield* gitOutput(runGit, gitStep);
            }
            return checkout;
          }),
        ))
      .extend("theWorktree", ({ theCheckout }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const home = yield* filesystem.makeTempDirectory({ prefix: "worktree-home-home-" });
            return yield* createWorktree({ cwd: theCheckout, home, name: "claude/fix-login" });
          }),
        ),
      )
      .extend("theWorktreeUnderHome", ({ theWorktree }) =>
        theWorktree.slice(theWorktree.indexOf("/worktrees/")),
      )
      .extend("theBranchOfTheWorktree", ({ theWorktree }) =>
        Effect.runPromise(
          gitOutput(runGit, { cwd: theWorktree, handed: ["rev-parse", "--abbrev-ref", "HEAD"] }),
        ),
      )
      .extend("theWorktreeHead", ({ theWorktree }) =>
        Effect.runPromise(gitOutput(runGit, { cwd: theWorktree, handed: ["rev-parse", "HEAD"] })),
      )
      .extend("theOriginHead", ({ theCheckout }) =>
        Effect.runPromise(
          gitOutput(runGit, { cwd: theCheckout, handed: ["rev-parse", "origin/main"] }),
        ),
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
      .extend("theSandbox", () =>
        Effect.runPromise(filesystem.makeTempDirectory({ prefix: "worktree-home-" })))
      .extend("theFailure", ({ theSandbox }) =>
        Effect.runPromise(
          Effect.flip(createWorktree({ cwd: theSandbox, home: theSandbox, name: "stray" })),
        ),
      );

    it("fails instead of creating a worktree", ({ theFailure, theSandbox }) => {
      expect(theFailure).toStrictEqual(
        new WorktreeHomeFailure({
          message: `worktree-home: ${theSandbox} is not inside a git repository`,
        }),
      );
    });
  });
});
