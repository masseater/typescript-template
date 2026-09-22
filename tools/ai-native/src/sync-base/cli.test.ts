import { env as processEnvironment } from "node:process";
import { fileURLToPath } from "node:url";

import { runHook } from "cc-hooks-ts";
import { Effect, Schema } from "effect";
import { describe, expect, test, vi } from "vite-plus/test";

import { joinPath, writeFileString } from "../host.ts";
import { spawnChildSync } from "../node-spawn.ts";
import { hook } from "./hook.ts";
import { instructionFor } from "./message.ts";

vi.mock(import("cc-hooks-ts"), { spy: true });

const CLI_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));
const nodeFs = process.getBuiltinModule("fs") as {
  readonly chmodSync: (location: string, mode: number) => void;
  readonly mkdtempSync: (prefix: string) => string;
};
const nodeOs = process.getBuiltinModule("os") as {
  readonly tmpdir: () => string;
};

const stopPayloadFor = (cwd: string): string =>
  JSON.stringify({
    cwd,
    hook_event_name: "Stop",
    session_id: "session",
    stop_hook_active: false,
    transcript_path: `${cwd}/transcript.jsonl`,
  });

const behindGhScript = `#!/bin/sh
echo '{"baseRefName":"main","mergeStateStatus":"BEHIND","number":11,"url":"https://example.com/11"}'
`;

describe("sync-base cli", () => {
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

  describe("a Stop where gh finds no pull request", () => {
    const it = test
      .extend("theWorkTreeWithoutAPullRequest", () =>
        nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "sync-base-no-pr-")),
      )
      .extend("theRunOverAStopWithoutAPullRequest", ({ theWorkTreeWithoutAPullRequest }) =>
        spawnChildSync({
          executable: process.execPath,
          handed: [CLI_PATH],
          spawnOptions: {
            encoding: "utf8",
            env: {
              ...processEnvironment,
              PATH: `/nonexistent-gh-bin:${processEnvironment.PATH ?? ""}`,
            },
            input: stopPayloadFor(theWorkTreeWithoutAPullRequest),
          },
        }),
      )
      .extend("theExitCodeOverAStopWithoutAPullRequest", ({ theRunOverAStopWithoutAPullRequest }) => {
        const { status } = theRunOverAStopWithoutAPullRequest;
        return status;
      })
      .extend(
        "theStandardOutputOverAStopWithoutAPullRequest",
        ({ theRunOverAStopWithoutAPullRequest }) => {
          const { stdout } = theRunOverAStopWithoutAPullRequest;
          return stdout;
        },
      );

    it(
      "ends on the code of a hook that finished",
      { timeout: 30_000 },
      ({ theExitCodeOverAStopWithoutAPullRequest }) => {
        expect(theExitCodeOverAStopWithoutAPullRequest).toBe(0);
      },
    );

    it(
      "leaves standard output empty",
      { timeout: 30_000 },
      ({ theStandardOutputOverAStopWithoutAPullRequest }) => {
        expect(theStandardOutputOverAStopWithoutAPullRequest).toBe("");
      },
    );
  });

  describe("a Stop where gh reports the head is behind its base", () => {
    const it = test
      .extend("theWorkTree", () => nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "sync-base-pr-")))
      .extend("theBinWithABehindGh", () => {
        const directory = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "sync-base-gh-"));
        const ghPath = joinPath(directory, "gh");
        writeFileString({ location: ghPath, written: behindGhScript });
        nodeFs.chmodSync(ghPath, 0o755);
        return directory;
      })
      .extend("theRunOverABehindPullRequest", ({ theBinWithABehindGh, theWorkTree }) =>
        spawnChildSync({
          executable: process.execPath,
          handed: [CLI_PATH],
          spawnOptions: {
            encoding: "utf8",
            env: {
              ...processEnvironment,
              PATH: `${theBinWithABehindGh}:${processEnvironment.PATH ?? ""}`,
            },
            input: stopPayloadFor(theWorkTree),
          },
        }),
      )
      .extend("theExitCodeOverABehindPullRequest", ({ theRunOverABehindPullRequest }) => {
        const { status } = theRunOverABehindPullRequest;
        return status;
      })
      .extend("theDecisionOverABehindPullRequest", ({ theRunOverABehindPullRequest }) =>
        Effect.runPromise(
          Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(
            theRunOverABehindPullRequest.stdout,
          ),
        ),
      );

    it(
      "ends on the code of a hook that finished",
      { timeout: 30_000 },
      ({ theExitCodeOverABehindPullRequest }) => {
        expect(theExitCodeOverABehindPullRequest).toBe(0);
      },
    );

    it(
      "puts the catch-up instruction on standard output",
      { timeout: 30_000 },
      ({ theDecisionOverABehindPullRequest }) => {
        expect(theDecisionOverABehindPullRequest).toStrictEqual({
          hookSpecificOutput: {
            additionalContext: instructionFor({
              baseRefName: "main",
              number: 11,
              url: "https://example.com/11",
            }),
            hookEventName: "Stop",
          },
        });
      },
    );
  });
});
