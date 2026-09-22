import { instructionOf } from "./instruction.ts";
import { openPullRequestOf, type CommandRunner } from "./read-open-pr.ts";

export type SyncBaseEvent = "SessionStart" | "Stop" | "UserPromptSubmit";

export type SyncBaseDecision =
  | {
      readonly event: "SessionStart";
      readonly output: {
        readonly hookSpecificOutput: {
          readonly additionalContext: string;
          readonly hookEventName: "SessionStart";
        };
      };
    }
  | {
      readonly event: "Stop";
      readonly output: {
        readonly hookSpecificOutput: {
          readonly additionalContext: string;
          readonly hookEventName: "Stop";
        };
      };
    }
  | {
      readonly event: "UserPromptSubmit";
      readonly output: {
        readonly hookSpecificOutput: {
          readonly additionalContext: string;
          readonly hookEventName: "UserPromptSubmit";
        };
      };
    };

const syncBaseEvents: ReadonlySet<string> = new Set([
  "SessionStart",
  "Stop",
  "UserPromptSubmit",
]);

const syncBaseEventOf = (eventName: string): SyncBaseEvent | undefined =>
  syncBaseEvents.has(eventName) ? (eventName as SyncBaseEvent) : undefined;

const decisionFor = (event: SyncBaseEvent, instruction: string): SyncBaseDecision => {
  switch (event) {
    case "SessionStart":
      return {
        event: "SessionStart",
        output: {
          hookSpecificOutput: {
            additionalContext: instruction,
            hookEventName: "SessionStart",
          },
        },
      };
    case "Stop":
      return {
        event: "Stop",
        output: {
          hookSpecificOutput: {
            additionalContext: instruction,
            hookEventName: "Stop",
          },
        },
      };
    case "UserPromptSubmit":
      return {
        event: "UserPromptSubmit",
        output: {
          hookSpecificOutput: {
            additionalContext: instruction,
            hookEventName: "UserPromptSubmit",
          },
        },
      };
  }
};

export const decisionOf = (
  eventName: string,
  cwd: string,
  run?: CommandRunner,
): SyncBaseDecision | undefined => {
  const event = syncBaseEventOf(eventName);
  if (event === undefined) {
    return undefined;
  }
  const instruction = instructionOf(openPullRequestOf(cwd, run));
  return instruction === undefined ? undefined : decisionFor(event, instruction);
};
