import { eq } from "drizzle-orm";
import { Clock, Effect } from "effect";

import { query } from "./database.ts";
import { RateLimitExceeded } from "./rate-limit-exceeded.ts";
import { rateLimit } from "./schema.ts";

const consumeRateLimit = Effect.fn("consumeRateLimit")(function* consumeRateLimit(
  key: string,
  max: number,
  windowMilliseconds: number,
) {
  const now = yield* Clock.currentTimeMillis;
  const [existing] = yield* query((database) =>
    database.select().from(rateLimit).where(eq(rateLimit.key, key)).limit(1),
  );
  if (existing === undefined) {
    yield* query((database) =>
      database.insert(rateLimit).values({ count: 1, id: key, key, lastRequest: now }),
    );
    return;
  }
  if (now - existing.lastRequest > windowMilliseconds) {
    yield* query((database) =>
      database.update(rateLimit).set({ count: 1, lastRequest: now }).where(eq(rateLimit.key, key)),
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
      .where(eq(rateLimit.key, key)),
  );
});

export { RateLimitExceeded } from "./rate-limit-exceeded.ts";
export { consumeRateLimit };
