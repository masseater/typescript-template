import { AUDIT_ACTION, auditEvent, query } from "@repo/db";
import { Effect } from "effect";

import { auditTargetForToggle, type FlagKey } from "./definitions.ts";

const recordFlagToggle = Effect.fn("recordFlagToggle")(function* recordFlagToggle(toggleAudit: {
  readonly actorId: string;
  readonly from: boolean;
  readonly flagKey: FlagKey;
  readonly to: boolean;
}) {
  yield* query((database) =>
    database.insert(auditEvent).values({
      action: AUDIT_ACTION.flagToggled,
      actorId: toggleAudit.actorId,
      createdAt: new Date(),
      id: crypto.randomUUID(),
      targetId: auditTargetForToggle({
        flagKey: toggleAudit.flagKey,
        from: toggleAudit.from,
        to: toggleAudit.to,
      }),
    }),
  );
});

export { recordFlagToggle };
