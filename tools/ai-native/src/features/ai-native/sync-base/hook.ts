import { defineHook } from "cc-hooks-ts";

import { decisionOf } from "./decision.ts";

export const hook: ReturnType<
  typeof defineHook<{ SessionStart: true; Stop: true; UserPromptSubmit: true }>
> = defineHook({
  trigger: {
    SessionStart: true,
    Stop: true,
    UserPromptSubmit: true,
  },
  run: (hookContext) => {
    const decision = decisionOf({
      cwd: hookContext.input.cwd,
      hookEventName: hookContext.input.hook_event_name,
    });
    if (decision === undefined) {
      return hookContext.success({});
    }
    return hookContext.json(decision as Parameters<(typeof hookContext)["json"]>[0]);
  },
});
