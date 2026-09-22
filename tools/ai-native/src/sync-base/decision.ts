import { instructionOf } from "./instruction.ts";
import { openPullRequestOf, type CommandRunner } from "./read-open-pr.ts";

export type DecisionInquiry = {
  readonly cwd: string;
  readonly hookEventName: string;
  readonly run?: CommandRunner;
};

/** @canonical-values sync-base.hook-event */
export const SYNC_BASE_HOOK_EVENTS = ["SessionStart", "Stop", "UserPromptSubmit"] as const;

export type SyncBaseEvent = (typeof SYNC_BASE_HOOK_EVENTS)[number];

const syncBaseEventOf = (hookEventName: string): SyncBaseEvent | undefined => {
  for (const knownHookEvent of SYNC_BASE_HOOK_EVENTS) {
    if (knownHookEvent === hookEventName) {
      return knownHookEvent;
    }
  }
  return undefined;
};

const decisionFor = (hookEvent: SyncBaseEvent, instruction: string) => {
  switch (hookEvent) {
    case "SessionStart":
      return {
        event: "SessionStart",
        output: {
          hookSpecificOutput: {
            additionalContext: instruction,
            hookEventName: "SessionStart",
          },
        },
      } as const;
    case "Stop":
      return {
        event: "Stop",
        output: {
          hookSpecificOutput: {
            additionalContext: instruction,
            hookEventName: "Stop",
          },
        },
      } as const;
    case "UserPromptSubmit":
      return {
        event: "UserPromptSubmit",
        output: {
          hookSpecificOutput: {
            additionalContext: instruction,
            hookEventName: "UserPromptSubmit",
          },
        },
      } as const;
  }
};

export type SyncBaseDecision = ReturnType<typeof decisionFor>;

export const decisionOf = (inquiry: DecisionInquiry): SyncBaseDecision | undefined => {
  const hookEvent = syncBaseEventOf(inquiry.hookEventName);
  if (hookEvent === undefined) {
    return undefined;
  }
  const instruction = instructionOf(openPullRequestOf(inquiry.cwd, inquiry.run));
  return instruction === undefined ? undefined : decisionFor(hookEvent, instruction);
};
