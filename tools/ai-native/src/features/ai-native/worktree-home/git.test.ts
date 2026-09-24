import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { filesystem, joinPath, removePath } from "../host.ts";
import { gitOutput, runGit } from "./git.ts";

describe("gitOutput", () => {
  describe("a git that cannot start in a missing directory", () => {
    const it = test
      .extend("theSandbox", ({}, { onCleanup }) => {
        const madeDirectory = Effect.runPromise(
          filesystem.makeTempDirectory({ prefix: "worktree-home-git-" }),
        );
        onCleanup(() =>
          Effect.runPromise(Effect.promise(() => madeDirectory).pipe(Effect.flatMap(removePath))),
        );
        return madeDirectory;
      })
      .extend("theCodeOfTheKeptCause", ({ theSandbox }) =>
        Effect.runPromise(
          Effect.flip(
            gitOutput(runGit, { cwd: joinPath(theSandbox, "absent"), handed: ["status"] }),
          ).pipe(
            Effect.map((gitFailure) =>
              gitFailure.cause !== undefined && "code" in gitFailure.cause
                ? gitFailure.cause.code
                : undefined,
            ),
          ),
        ),
      );

    it("keeps the error that stopped the start as its cause", ({ theCodeOfTheKeptCause }) => {
      expect(theCodeOfTheKeptCause).toBe("ENOENT");
    });
  });
});
