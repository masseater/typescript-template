import { defineHook } from "cc-hooks-ts";
import { Effect } from "effect";

import { homeDirectory } from "../host-facts.ts";
import { createWorktree } from "./create-worktree.ts";
import { denyReasonOf } from "./deny-reason.ts";
import { repositoryRootOf, runGit } from "./git.ts";
import { removeWorktree } from "./remove-worktree.ts";

export const hook: ReturnType<
  typeof defineHook<{ PreToolUse: true; WorktreeCreate: true; WorktreeRemove: true }>
> = defineHook({
  trigger: { PreToolUse: true, WorktreeCreate: true, WorktreeRemove: true },
  run: (hookContext) => {
    const { input } = hookContext;
    switch (input.hook_event_name) {
      case "WorktreeCreate":
        return Effect.runPromise(
          createWorktree({
            cwd: input.cwd,
            home: homeDirectory(),
            name: input.name,
          }).pipe(Effect.map((location) => hookContext.success({ messageForUser: location }))),
        );
      case "WorktreeRemove":
        return Effect.runPromise(
          removeWorktree(input.worktree_path).pipe(Effect.map(() => hookContext.success({}))),
        );
      case "PreToolUse":
        return Effect.runPromise(
          denyReasonOf({
            cwd: input.cwd,
            home: homeDirectory(),
            repositoryRootOf: (directory) => repositoryRootOf(runGit, directory),
            toolInput: input.tool_input,
            toolName: input.tool_name,
          }).pipe(
            Effect.map((refusal) =>
              refusal === undefined
                ? hookContext.success({})
                : hookContext.json({
                    event: "PreToolUse",
                    output: {
                      hookSpecificOutput: {
                        hookEventName: "PreToolUse",
                        permissionDecision: "deny",
                        permissionDecisionReason: refusal,
                      },
                    },
                  }),
            ),
          ),
        );
    }
  },
});
