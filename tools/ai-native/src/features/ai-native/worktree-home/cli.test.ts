import { runHook } from "cc-hooks-ts";
import { Effect } from "effect";
import { describe, expect, test, vi } from "vite-plus/test";

import { joinPath } from "../host.ts";
import { spawnChildSync } from "../node-spawn.ts";
import { gitOutput, runGit } from "./git.ts";
import { hook } from "./hook.ts";

vi.mock(import("cc-hooks-ts"), { spy: true });

const CLI_PATH = joinPath(import.meta.dirname, "cli.ts");

const nodeFs = process.getBuiltinModule("fs") as {
  readonly mkdtempSync: (prefix: string) => string;
};
const nodeOs = process.getBuiltinModule("os") as {
  readonly tmpdir: () => string;
};

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
      .extend("theSandbox", () => nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "worktree-home-")))
      .extend("theRun", ({ theSandbox }) => {
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
        return spawnChildSync({
          executable: process.execPath,
          handed: [CLI_PATH],
          spawnOptions: {
            encoding: "utf8",
            env: { ...process.env, HOME: joinPath(theSandbox, "home") },
            input: JSON.stringify({
              cwd: checkout,
              hook_event_name: "WorktreeCreate",
              name: "from-cli",
              session_id: "session",
              transcript_path: `${checkout}/transcript.jsonl`,
            }),
          },
        });
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
      .extend("theSandbox", () => nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "worktree-home-")))
      .extend("theExitCode", ({ theSandbox }) => {
        const { status } = spawnChildSync({
          executable: process.execPath,
          handed: [CLI_PATH],
          spawnOptions: {
            encoding: "utf8",
            env: { ...process.env, HOME: theSandbox },
            input: JSON.stringify({
              cwd: theSandbox,
              hook_event_name: "WorktreeCreate",
              name: "nowhere",
              session_id: "session",
              transcript_path: `${theSandbox}/transcript.jsonl`,
            }),
          },
        });
        return status;
      });

    it(
      "exits with a failure so Claude Code aborts the creation",
      { timeout: 30_000 },
      ({ theExitCode }) => {
        expect(theExitCode).toBe(1);
      },
    );
  });
});
