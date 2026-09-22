import { defineHook } from "cc-hooks-ts";

import { decisionOf } from "./decision.ts";
import { defaultCommandRunner, type CommandRunner } from "./read-open-pr.ts";

type SyncBaseHookTrigger = {
  SessionStart: true;
  Stop: true;
  UserPromptSubmit: true;
};

export const hookFor = (
  run: CommandRunner = defaultCommandRunner,
): ReturnType<typeof defineHook<SyncBaseHookTrigger>> =>
  defineHook({
    trigger: {
      SessionStart: true,
      Stop: true,
      UserPromptSubmit: true,
    },
    run: (hookContext) => {
      const decision = decisionOf({
        cwd: hookContext.input.cwd,
        hookEventName: hookContext.input.hook_event_name,
        run,
      });
      if (decision === undefined) {
        return hookContext.success({});
      }
      return hookContext.json(decision as Parameters<(typeof hookContext)["json"]>[0]);
    },
  });

export const hook: ReturnType<typeof defineHook<SyncBaseHookTrigger>> = hookFor();
