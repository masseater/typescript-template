import { describe, expect, test } from "vite-plus/test";

import { decisionOf } from "./decision.ts";
import { instructionFor } from "./message.ts";

const behindPrJson =
  '{"baseRefName":"cursor/parent-e1f8","mergeStateStatus":"BEHIND","number":15,"url":"https://example.com/15"}';

describe("decisionOf", () => {
  describe("a Stop event over a pull request behind its base", () => {
    const it = test.extend("theDecisionForStop", () =>
      decisionOf({
        cwd: "/repo",
        hookEventName: "Stop",
        run: () => ({ status: 0, stdout: behindPrJson }),
      }));

    it("asks Claude to catch up through Stop additionalContext", ({ theDecisionForStop }) => {
      expect(theDecisionForStop).toStrictEqual({
        event: "Stop",
        output: {
          hookSpecificOutput: {
            additionalContext: instructionFor({
              baseRefName: "cursor/parent-e1f8",
              number: 15,
              url: "https://example.com/15",
            }),
            hookEventName: "Stop",
          },
        },
      });
    });
  });

  describe("a UserPromptSubmit event over a pull request behind its base", () => {
    const it = test.extend("theDecisionForUserPromptSubmit", () =>
      decisionOf({
        cwd: "/repo",
        hookEventName: "UserPromptSubmit",
        run: () => ({ status: 0, stdout: behindPrJson }),
      }));

    it("asks Claude to catch up through UserPromptSubmit additionalContext", ({
      theDecisionForUserPromptSubmit,
    }) => {
      expect(theDecisionForUserPromptSubmit).toStrictEqual({
        event: "UserPromptSubmit",
        output: {
          hookSpecificOutput: {
            additionalContext: instructionFor({
              baseRefName: "cursor/parent-e1f8",
              number: 15,
              url: "https://example.com/15",
            }),
            hookEventName: "UserPromptSubmit",
          },
        },
      });
    });
  });

  describe("a SessionStart event over a pull request behind its base", () => {
    const it = test.extend("theDecisionForSessionStart", () =>
      decisionOf({
        cwd: "/repo",
        hookEventName: "SessionStart",
        run: () => ({ status: 0, stdout: behindPrJson }),
      }));

    it("asks Claude to catch up through SessionStart additionalContext", ({
      theDecisionForSessionStart,
    }) => {
      expect(theDecisionForSessionStart).toStrictEqual({
        event: "SessionStart",
        output: {
          hookSpecificOutput: {
            additionalContext: instructionFor({
              baseRefName: "cursor/parent-e1f8",
              number: 15,
              url: "https://example.com/15",
            }),
            hookEventName: "SessionStart",
          },
        },
      });
    });
  });

  describe("events and pull request states that need no instruction", () => {
    const it = test
      .extend("theDecisionForAnUnknownEvent", () =>
        decisionOf({
          cwd: "/repo",
          hookEventName: "PreToolUse",
          run: () => ({ status: 0, stdout: behindPrJson }),
        }))
      .extend("theDecisionWhenGhFindsNoPullRequest", () =>
        decisionOf({
          cwd: "/repo",
          hookEventName: "Stop",
          run: () => ({ status: 1, stdout: "" }),
        }),
      )
      .extend("theDecisionWhenTheHeadIsClean", () =>
        decisionOf({
          cwd: "/repo",
          hookEventName: "Stop",
          run: () => ({
            status: 0,
            stdout:
              '{"baseRefName":"main","mergeStateStatus":"CLEAN","number":15,"url":"https://example.com/15"}',
          }),
        }),
      );

    it("says nothing for an event this hook does not own", ({ theDecisionForAnUnknownEvent }) => {
      expect(theDecisionForAnUnknownEvent).toBe(undefined);
    });

    it("says nothing when gh finds no pull request", ({ theDecisionWhenGhFindsNoPullRequest }) => {
      expect(theDecisionWhenGhFindsNoPullRequest).toBe(undefined);
    });

    it("says nothing when the head is already current", ({ theDecisionWhenTheHeadIsClean }) => {
      expect(theDecisionWhenTheHeadIsClean).toBe(undefined);
    });
  });
});
