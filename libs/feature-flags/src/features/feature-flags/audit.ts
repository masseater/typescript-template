import { AUDIT_ACTION, auditEvent, query } from "@repo/db";
import { Crypto, DateTime, Effect } from "effect";

import { auditTargetForToggle, type FlagKey } from "./definitions.ts";

const platformCrypto = Crypto.make({
  digest: (algorithm, digestInput) =>
    Effect.tryPromise(() => crypto.subtle.digest(algorithm, Uint8Array.from(digestInput))).pipe(
      Effect.map((digestBytes) => new Uint8Array(digestBytes)),
      Effect.orDie,
    ),
  randomBytes: (byteCount) => crypto.getRandomValues(new Uint8Array(byteCount)),
});

const recordFlagToggle = Effect.fn("recordFlagToggle")(function* recordFlagToggle(toggleAudit: {
  readonly actorId: string;
  readonly from: boolean;
  readonly flagKey: FlagKey;
  readonly to: boolean;
}) {
  const createdAt = DateTime.toDate(yield* DateTime.now);
  const auditId = yield* platformCrypto.randomUUIDv4.pipe(Effect.orDie);
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
