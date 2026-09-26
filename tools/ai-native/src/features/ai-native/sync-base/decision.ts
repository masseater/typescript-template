import { Effect } from "effect";

import { instructionOf } from "./instruction.ts";
import { openPullRequestOf, type CommandRunner } from "./read-open-pr.ts";

export type DecisionInquiry = {
  readonly cwd: string;
  readonly hookEventName: string;
  readonly run?: CommandRunner;
};

/** @canonical-values sync-base.hook-event */
const SYNC_BASE_HOOK_EVENTS = ["SessionStart", "Stop", "UserPromptSubmit"] as const;

type SyncBaseEvent = (typeof SYNC_BASE_HOOK_EVENTS)[number];

const syncBaseEventOf = (hookEventName: string): SyncBaseEvent | undefined => {
  for (const knownHookEvent of SYNC_BASE_HOOK_EVENTS) {
    if (knownHookEvent === hookEventName) {
      return knownHookEvent;
    }
  }
  return undefined;
};

type EventDecision<Event extends SyncBaseEvent> = {
  readonly event: Event;
  readonly output: {
    readonly hookSpecificOutput: {
      readonly additionalContext: string;
      readonly hookEventName: Event;
    };
  };
};

export type SyncBaseDecision = {
  readonly [Event in SyncBaseEvent]: EventDecision<Event>;
}[SyncBaseEvent];

const eventDecision = <Event extends SyncBaseEvent>(
  hookEvent: Event,
  instruction: string,
): EventDecision<Event> => ({
  event: hookEvent,
  output: {
    hookSpecificOutput: {
      additionalContext: instruction,
      hookEventName: hookEvent,
    },
  },
});

const decisionFor = (hookEvent: SyncBaseEvent, instruction: string): SyncBaseDecision => {
  switch (hookEvent) {
    case "SessionStart": {
      return eventDecision("SessionStart", instruction);
    }
    case "Stop": {
      return eventDecision("Stop", instruction);
    }
    case "UserPromptSubmit": {
      return eventDecision("UserPromptSubmit", instruction);
    }
  }
};

export const decisionOf = (
  inquiry: DecisionInquiry,
): Effect.Effect<SyncBaseDecision | undefined> => {
  const hookEvent = syncBaseEventOf(inquiry.hookEventName);
  if (hookEvent === undefined) {
    return Effect.succeed(hookEvent);
  }
  return openPullRequestOf(inquiry.cwd, inquiry.run).pipe(
    Effect.map((openPullRequest) => {
      const instruction = instructionOf(openPullRequest);
      return instruction === undefined ? undefined : decisionFor(hookEvent, instruction);
    }),
  );
};
export type { SyncBaseEvent };
