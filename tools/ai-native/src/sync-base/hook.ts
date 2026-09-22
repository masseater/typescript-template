import { defineHook } from "cc-hooks-ts";

import { decisionOf } from "./decision.ts";
import { defaultCommandRunner, type CommandRunner } from "./read-open-pr.ts";

export const hookFor = (
  run: CommandRunner = defaultCommandRunner,
): ReturnType<typeof defineHook<{ SessionStart: true; Stop: true; UserPromptSubmit: true }>> =>
  defineHook({
    trigger: {
      SessionStart: true,
      Stop: true,
      UserPromptSubmit: true,
    },
    run: (hookContext) => {
      const decision = decisionOf(hookContext.input.hook_event_name, hookContext.input.cwd, run);
      if (decision === undefined) {
        return hookContext.success({});
      }
      return hookContext.json(decision);
    },
  });

export const hook: ReturnType<
  typeof defineHook<{ SessionStart: true; Stop: true; UserPromptSubmit: true }>
> = hookFor();
