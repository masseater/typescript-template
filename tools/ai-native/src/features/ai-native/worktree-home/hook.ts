import { defineHook } from "cc-hooks-ts";

import { homeDirectory } from "../host.ts";
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
        return hookContext.success({
          messageForUser: createWorktree({
            cwd: input.cwd,
            home: homeDirectory(),
            name: input.name,
          }),
        });
      case "WorktreeRemove":
        removeWorktree(input.worktree_path);
        return hookContext.success({});
      case "PreToolUse": {
        const refusal = denyReasonOf({
          cwd: input.cwd,
          home: homeDirectory(),
          repositoryRootOf: (directory) => repositoryRootOf(runGit, directory),
          toolInput: input.tool_input,
          toolName: input.tool_name,
        });
        return refusal === undefined
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
            });
      }
    }
  },
});
