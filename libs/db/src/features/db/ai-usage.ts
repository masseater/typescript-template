import { and, asc, count, eq, gte, isNull, sum } from "drizzle-orm";
import { Effect } from "effect";

import { aiUsageEvent } from "./billing-schema.ts";
import { clockDate } from "./clock-date.ts";
import { query } from "./database.ts";

const recordAiUsage = Effect.fn("recordAiUsage")(function* recordAiUsage(
  usage: Readonly<{ identifier: string; memberId: string; quantity: number }>,
) {
  const occurredAt = yield* clockDate;
  const [stored] = yield* query((database) =>
    database
      .insert(aiUsageEvent)
      .values({ ...usage, occurredAt, reportedAt: null })
      .onConflictDoNothing()
      .returning({ identifier: aiUsageEvent.identifier }),
  );
  return stored !== undefined;
});

const markAiUsageReported = Effect.fn("markAiUsageReported")(function* markAiUsageReported(
  identifier: string,
) {
  const reportedAt = yield* clockDate;
  yield* query((database) =>
    database
      .update(aiUsageEvent)
      .set({ reportedAt })
      .where(and(eq(aiUsageEvent.identifier, identifier), isNull(aiUsageEvent.reportedAt))),
  );
});

const unreportedAiUsage = Effect.fn("unreportedAiUsage")(function* unreportedAiUsage(
  member: Readonly<{ memberId: string; since: Date }>,
) {
  return yield* query((database) =>
    database
      .select({
        identifier: aiUsageEvent.identifier,
        occurredAt: aiUsageEvent.occurredAt,
        quantity: aiUsageEvent.quantity,
      })
      .from(aiUsageEvent)
      .where(
        and(
          eq(aiUsageEvent.memberId, member.memberId),
          gte(aiUsageEvent.occurredAt, member.since),
          isNull(aiUsageEvent.reportedAt),
        ),
      )
      .orderBy(asc(aiUsageEvent.occurredAt)),
  );
});

const aiUsageSince = Effect.fn("aiUsageSince")(function* aiUsageSince(
  member: Readonly<{ memberId: string; since: Date }>,
) {
  const [recorded] = yield* query((database) =>
    database
      .select({ events: count(), quantity: sum(aiUsageEvent.quantity) })
      .from(aiUsageEvent)
      .where(
        and(eq(aiUsageEvent.memberId, member.memberId), gte(aiUsageEvent.occurredAt, member.since)),
      ),
  );
  const [unreported] = yield* query((database) =>
    database
      .select({ events: count() })
      .from(aiUsageEvent)
      .where(
        and(
          eq(aiUsageEvent.memberId, member.memberId),
          gte(aiUsageEvent.occurredAt, member.since),
          isNull(aiUsageEvent.reportedAt),
        ),
      ),
  );
  return {
    events: recorded?.events ?? 0,
    quantity: Number(recorded?.quantity ?? 0),
    unreported: unreported?.events ?? 0,
  };
});

export { aiUsageSince, markAiUsageReported, recordAiUsage, unreportedAiUsage };
