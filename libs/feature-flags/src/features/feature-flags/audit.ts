import { webCrypto } from "@repo/config";
import { AUDIT_ACTION, auditEvent, query } from "@repo/db";
import { DateTime, Effect } from "effect";

import { auditTargetForToggle, type FlagKey } from "./definitions.ts";

const recordFlagToggle = Effect.fn("recordFlagToggle")(function* recordFlagToggle(toggleAudit: {
  readonly actorId: string;
  readonly from: boolean;
  readonly flagKey: FlagKey;
  readonly to: boolean;
}) {
  const createdAt = DateTime.toDate(yield* DateTime.now);
  const auditId = yield* webCrypto.randomUUIDv4.pipe(Effect.orDie);
  yield* query((database) =>
    database.insert(auditEvent).values({
      action: AUDIT_ACTION.flagToggled,
      actorId: toggleAudit.actorId,
      createdAt,
      id: auditId,
      targetId: auditTargetForToggle({
        flagKey: toggleAudit.flagKey,
        from: toggleAudit.from,
        to: toggleAudit.to,
      }),
    }),
  );
});

export { recordFlagToggle };
