import { runHook } from "cc-hooks-ts";
import { Effect } from "effect";
import { describe, expect, test, vi } from "vite-plus/test";

import { runCaptured } from "../child-process.ts";
import { filesystem, inheritedEnvironment, joinPath } from "../host.ts";
import { gitOutput, runGit } from "./git.ts";
import { hook } from "./hook.ts";

vi.mock(import("cc-hooks-ts"), { spy: true });

const CLI_PATH = joinPath(import.meta.dirname, "cli.ts");

const originAddress = "https://git.example.test/acme/widgets.git";

describe("worktree-home cli", () => {
  describe("the entry module", () => {
    const it = test.extend("theRunnerTheEntryReached", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          // mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- whether the runner settles is decided by the standard input it reads inside the boundary this spec replaces, and the entry awaits it
          vi.mocked(runHook).mockResolvedValue(undefined);
          yield* Effect.promise(() => import("./cli.ts"));
          return vi.mocked(runHook);
        }),
      ));

    it("is handed the hook definition of this package", ({ theRunnerTheEntryReached }) => {
      expect(theRunnerTheEntryReached).toHaveBeenCalledExactlyOnceWith(hook);
    });
  });

  describe("a WorktreeCreate event in a repository with an origin", () => {
    const it = test
      .extend("theSandbox", () =>
        Effect.runPromise(filesystem.makeTempDirectory({ prefix: "worktree-home-" })))
      .extend("theRun", ({ theSandbox }) => {
        const origin = joinPath(theSandbox, "origin.git");
        const checkout = joinPath(theSandbox, "checkout");
        const hookInput = JSON.stringify({
          cwd: checkout,
          hook_event_name: "WorktreeCreate",
          name: "from-cli",
          session_id: "session",
          transcript_path: `${checkout}/transcript.jsonl`,
        });
        return Effect.runPromise(
          Effect.gen(function* () {
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
            return yield* runCaptured({
              executable: process.execPath,
              handed: [CLI_PATH],
              env: { ...inheritedEnvironment(), HOME: joinPath(theSandbox, "home") },
              input: hookInput,
            });
          }),
        );
      })
      .extend("theStandardOutput", ({ theRun }) => {
        const { stdout } = theRun;
        return stdout;
      });

    it(
      "prints the created worktree path as its standard output",
      { timeout: 30_000 },
      ({ theSandbox, theStandardOutput }) => {
        expect(theStandardOutput).toBe(
          `${joinPath(theSandbox, "home", "worktrees", "git.example.test", "acme", "widgets", "from-cli")}\n`,
        );
      },
    );
  });

  describe("a WorktreeCreate event outside any repository", () => {
    const it = test
      .extend("theSandbox", () =>
        Effect.runPromise(filesystem.makeTempDirectory({ prefix: "worktree-home-" })))
      .extend("theExitCode", ({ theSandbox }) =>
        Effect.runPromise(
          runCaptured({
            executable: process.execPath,
            handed: [CLI_PATH],
            env: { ...inheritedEnvironment(), HOME: theSandbox },
            input: JSON.stringify({
              cwd: theSandbox,
              hook_event_name: "WorktreeCreate",
              name: "nowhere",
              session_id: "session",
              transcript_path: `${theSandbox}/transcript.jsonl`,
            }),
          }).pipe(Effect.map(({ status }) => status)),
        ),
      );

    it(
      "exits with a failure so Claude Code aborts the creation",
      { timeout: 30_000 },
      ({ theExitCode }) => {
        expect(theExitCode).toBe(1);
      },
    );
  });
});
