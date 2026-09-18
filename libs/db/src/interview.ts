import { and, eq, sql } from "drizzle-orm";
import { Clock, Effect } from "effect";

import { query } from "./database.ts";
import { InterviewConflict } from "./interview-conflict.ts";
import { InterviewLimitReached } from "./interview-limit-reached.ts";
import { interview } from "./schema.ts";

const dayLength = 10;

const recordColumns = {
  savedSheet: interview.savedSheet,
  state: interview.state,
  version: interview.version,
};

const currentTime = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));

const findInterview = Effect.fn("findInterview")(function* findInterview(userId: string) {
  const [record] = yield* query((database) =>
    database.select(recordColumns).from(interview).where(eq(interview.userId, userId)).limit(1),
  );
  // oxlint-disable-next-line unicorn/no-null
  return record ?? null;
});

const startInterview = Effect.fn("startInterview")(function* startInterview(
  userId: string,
  state: unknown,
) {
  const now = yield* currentTime;
  const day = now.toISOString().slice(0, dayLength);
  yield* query((database) =>
    database.insert(interview).values({ day, state, updatedAt: now, userId }).onConflictDoNothing(),
  );
});

const countInterviewTurn = Effect.fn("countInterviewTurn")(function* countInterviewTurn(
  userId: string,
  limit: number,
) {
  const day = (yield* currentTime).toISOString().slice(0, dayLength);
  const turns = sql<number>`CASE WHEN ${interview.day} = ${day} THEN ${interview.turns} + 1 ELSE 1 END`;
  const [counted] = yield* query((database) =>
    database
      .update(interview)
      .set({ day, turns })
      .where(eq(interview.userId, userId))
      .returning({ turns: interview.turns }),
  );
  if (counted === undefined || counted.turns > limit) {
    return yield* new InterviewLimitReached();
  }
});

const storeInterview = Effect.fn("storeInterview")(function* storeInterview(
  userId: string,
  version: number,
  content: { readonly savedSheet?: unknown; readonly state: unknown },
) {
  const updatedAt = yield* currentTime;
  const [stored] = yield* query((database) =>
    database
      .update(interview)
      .set({ ...content, updatedAt, version: version + 1 })
      .where(and(eq(interview.userId, userId), eq(interview.version, version)))
      .returning({ version: interview.version }),
  );
  if (stored === undefined) {
    return yield* new InterviewConflict();
  }
});

export { InterviewConflict } from "./interview-conflict.ts";
export { InterviewLimitReached } from "./interview-limit-reached.ts";
export { countInterviewTurn, findInterview, startInterview, storeInterview };
