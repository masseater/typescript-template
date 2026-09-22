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

export type SyncBaseDecision = {
  readonly event: SyncBaseEvent;
  readonly output: {
    readonly hookSpecificOutput: {
      readonly additionalContext: string;
      readonly hookEventName: SyncBaseEvent;
    };
  };
};

const decisionFor = (hookEvent: SyncBaseEvent, instruction: string): SyncBaseDecision => ({
  event: hookEvent,
  output: {
    hookSpecificOutput: {
      additionalContext: instruction,
      hookEventName: hookEvent,
    },
  },
});

export const decisionOf = (inquiry: DecisionInquiry): SyncBaseDecision | undefined => {
  const hookEvent = syncBaseEventOf(inquiry.hookEventName);
  if (hookEvent === undefined) {
    return undefined;
  }
  const instruction = instructionOf(openPullRequestOf(inquiry.cwd, inquiry.run));
  return instruction === undefined ? undefined : decisionFor(hookEvent, instruction);
};
