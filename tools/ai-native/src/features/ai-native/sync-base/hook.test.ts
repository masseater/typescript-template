import { describe, expect, test } from "vite-plus/test";

import { joinPath } from "../host.ts";
import { hook } from "./hook.ts";

const nodeFs = process.getBuiltinModule("fs") as {
  readonly mkdtempSync: (prefix: string) => string;
};
const nodeOs = process.getBuiltinModule("os") as {
  readonly tmpdir: () => string;
};

describe("sync-base hook", () => {
  describe("a Stop in a work tree with no open pull request", () => {
    const it = test
      .extend("theWorkTree", () => nodeFs.mkdtempSync(joinPath(nodeOs.tmpdir(), "sync-base-hook-")))
      .extend("decisionForAStopWithoutAPullRequest", ({ theWorkTree }) =>
        hook.run({
          input: {
            cwd: theWorkTree,
            hook_event_name: "Stop",
            session_id: "session",
            stop_hook_active: false,
            transcript_path: `${theWorkTree}/transcript.jsonl`,
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

    it("passes with an empty success payload", ({ decisionForAStopWithoutAPullRequest }) => {
      expect(decisionForAStopWithoutAPullRequest).toStrictEqual({ kind: "success", payload: {} });
    });
  });
});
