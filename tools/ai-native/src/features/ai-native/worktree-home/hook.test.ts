import { describe, expect, test } from "vite-plus/test";

import { joinPath } from "../host.ts";
import { gitOutput, runGit } from "./git.ts";
import { hook } from "./hook.ts";
import { insideRepositoryReason } from "./message.ts";

const nodeFs = process.getBuiltinModule("fs") as {
  readonly mkdtempSync: (prefix: string) => string;
};
const nodeOs = process.getBuiltinModule("os") as {
  readonly tmpdir: () => string;
};

describe("worktree-home hook", () => {
  describe("a Bash command adding a worktree inside the repository", () => {
    const it = test
      .extend("theCheckout", () => {
        const checkout = nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "worktree-home-"));
        gitOutput(runGit, { cwd: checkout, handed: ["init", "--quiet", "-b", "main"] });
        return checkout;
      })
      .extend("theDecision", ({ theCheckout }) =>
        hook.run({
          input: {
            cwd: theCheckout,
            hook_event_name: "PreToolUse",
            session_id: "session",
            tool_input: { command: "git worktree add .claude/worktrees/x" },
            tool_name: "Bash",
            tool_use_id: "toolu_1",
            transcript_path: `${theCheckout}/transcript.jsonl`,
          },
          blockingError: (blockingMessage) => ({
            kind: "blocking-error",
            payload: blockingMessage,
          }),
          defer: (deferred, deferSettings) => ({
            kind: "json-async",
            run: deferred,
            timeoutMs: deferSettings?.timeoutMs,
          }),
          json: (jsonPayload) => ({ kind: "json-sync", payload: jsonPayload }),
          nonBlockingError: (warning) => ({
            kind: "non-blocking-error",
            ...(warning === undefined ? {} : { payload: warning }),
          }),
          success: (successPayload) => ({ kind: "success", payload: successPayload ?? {} }),
        }),
      );

    it("denies it with the way out", ({ theCheckout, theDecision }) => {
      expect(theDecision).toStrictEqual({
        kind: "json-sync",
        payload: {
          event: "PreToolUse",
          output: {
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "deny",
              permissionDecisionReason: insideRepositoryReason(
                joinPath(theCheckout, ".claude", "worktrees", "x"),
                theCheckout,
              ),
            },
          },
        },
      });
    });
  });
});
