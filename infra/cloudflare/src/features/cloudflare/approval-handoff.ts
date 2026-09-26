import { Effect, FileSystem } from "effect";

import { CloudflareFailure } from "./config.ts";
import { layer } from "./platform.ts";

import type { StackName } from "./stacks.ts";

interface PendingApproval {
  readonly confirmation: string;
  readonly stack: StackName;
}

const approvalOutputs = {
  confirmation: "approval-confirmation",
  stack: "approval-stack",
} as const satisfies Record<keyof PendingApproval, string>;

const handOffApproval = Effect.fn("handOffApproval")(function* handOffApproval(
  pending: PendingApproval,
  output: string | undefined,
) {
  if (output === undefined || output === "") {
    return false;
  }
  const filesystem = yield* FileSystem.FileSystem;
  yield* filesystem
    .writeFileString(
      output,
      `${approvalOutputs.stack}=${pending.stack}\n${approvalOutputs.confirmation}=${pending.confirmation}\n`,
      { flag: "a" },
    )
    .pipe(
      Effect.mapError(
        () => new CloudflareFailure({ code: "approval_handoff_unwritable", keys: [pending.stack] }),
      ),
    );
  return true;
}, Effect.provide(layer));

export { handOffApproval };
export type { PendingApproval };
