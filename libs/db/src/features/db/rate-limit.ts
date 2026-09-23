import { eq } from "drizzle-orm";
import { Clock, Effect } from "effect";

import { query } from "./database.ts";
import { RateLimitExceeded } from "./rate-limit-exceeded.ts";
import { rateLimit } from "./schema.ts";

const consumeRateLimit = Effect.fn("consumeRateLimit")(function* consumeRateLimit(limit: {
  readonly bucketKey: string;
  readonly max: number;
  readonly windowMilliseconds: number;
}) {
  const { bucketKey, max, windowMilliseconds } = limit;
  const observedAt = yield* Clock.currentTimeMillis;
  const [existing] = yield* query((database) =>
    database.select().from(rateLimit).where(eq(rateLimit.key, bucketKey)).limit(1),
  );
  if (existing === undefined || observedAt - existing.lastRequest > windowMilliseconds) {
    yield* query((database) =>
      existing === undefined
        ? database
            .insert(rateLimit)
            .values({ count: 1, id: bucketKey, key: bucketKey, lastRequest: observedAt })
        : database
            .update(rateLimit)
            .set({ count: 1, lastRequest: observedAt })
            .where(eq(rateLimit.key, bucketKey)),
    );
    return;
  }
  if (existing.count >= max) {
    return yield* new RateLimitExceeded();
  }
  yield* query((database) =>
    database
      .update(rateLimit)
      .set({ count: existing.count + 1 })
      .where(eq(rateLimit.key, bucketKey)),
  );
});

export { RateLimitExceeded } from "./rate-limit-exceeded.ts";
export { consumeRateLimit };
