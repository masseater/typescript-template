import { optionalSetting } from "@repo/ai-native-telemetry/optional-setting";
import { runHook } from "cc-hooks-ts";
import { Effect, Schema } from "effect";
import { describe, expect, test, vi } from "vite-plus/test";

import { runCaptured } from "../child-process.ts";
import { filesystem, paths, writeFileString } from "../host.ts";
import { hook } from "./hook.ts";
import { instructionFor } from "./message.ts";

vi.mock(import("cc-hooks-ts"), { spy: true });

const CLI_PATH = paths.join(import.meta.dirname, "cli.ts");
const BEHIND_GH_SCRIPT = `#!/bin/sh
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
        Effect.runPromise(filesystem.makeTempDirectory({ prefix: "sync-base-no-pr-" })))
      .extend("theRunOverAStopWithoutAPullRequest", ({ theWorkTreeWithoutAPullRequest }) =>
        Effect.runPromise(
          runCaptured({
            executable: process.execPath,
            handed: [CLI_PATH],
            env: {
              ...process.env,
              PATH: `/nonexistent-gh-bin:${optionalSetting("PATH") ?? ""}`,
            },
            input: JSON.stringify({
              cwd: theWorkTreeWithoutAPullRequest,
              hook_event_name: "Stop",
              session_id: "session",
              stop_hook_active: false,
              transcript_path: `${theWorkTreeWithoutAPullRequest}/transcript.jsonl`,
            }),
          }),
        ),
      )
      .extend(
        "theExitCodeOverAStopWithoutAPullRequest",
        ({ theRunOverAStopWithoutAPullRequest }) => {
          const { status } = theRunOverAStopWithoutAPullRequest;
          return status;
        },
      )
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
      .extend("theWorkTree", () =>
        Effect.runPromise(filesystem.makeTempDirectory({ prefix: "sync-base-pr-" })))
      .extend("theBinWithABehindGh", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const directory = yield* filesystem.makeTempDirectory({ prefix: "sync-base-gh-" });
            const ghPath = paths.join(directory, "gh");
            yield* writeFileString({ location: ghPath, written: BEHIND_GH_SCRIPT });
            yield* filesystem.chmod(ghPath, 0o755);
            return directory;
          }),
        ),
      )
      .extend("theRunOverABehindPullRequest", ({ theBinWithABehindGh, theWorkTree }) =>
        Effect.runPromise(
          runCaptured({
            executable: process.execPath,
            handed: [CLI_PATH],
            env: {
              ...process.env,
              PATH: `${theBinWithABehindGh}:${optionalSetting("PATH") ?? ""}`,
            },
            input: JSON.stringify({
              cwd: theWorkTree,
              hook_event_name: "Stop",
              session_id: "session",
              stop_hook_active: false,
              transcript_path: `${theWorkTree}/transcript.jsonl`,
            }),
          }),
        ),
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
