import { defineHook } from "cc-hooks-ts";
import { Effect } from "effect";

import { decisionOf } from "./decision.ts";

export const hook: ReturnType<
  typeof defineHook<{ SessionStart: true; Stop: true; UserPromptSubmit: true }>
> = defineHook({
  trigger: {
    SessionStart: true,
    Stop: true,
    UserPromptSubmit: true,
  },
  run: (hookContext) =>
    Effect.runPromise(
      decisionOf({
        cwd: hookContext.input.cwd,
        hookEventName: hookContext.input.hook_event_name,
      }).pipe(
        Effect.map((decision) =>
          decision === undefined ? hookContext.success({}) : hookContext.json(decision),
        ),
      ),
    ),
});
