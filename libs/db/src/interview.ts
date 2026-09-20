import { and, eq, sql } from "drizzle-orm";
import { Clock, Effect } from "effect";

import { query } from "./database.ts";
import { InterviewConflict } from "./interview-conflict.ts";
import { InterviewLimitReached } from "./interview-limit-reached.ts";
import { interview } from "./schema.ts";

const dayLength = 10;

const savedColumns = {
  savedSheet: interview.savedSheet,
  state: interview.state,
  version: interview.version,
};

const clockDate = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));

export const findInterview = Effect.fn("findInterview")(function* findInterview(userId: string) {
  const [savedInterview] = yield* query((database) =>
    database.select(savedColumns).from(interview).where(eq(interview.userId, userId)).limit(1),
  );

  return savedInterview ?? null;
});

export const startInterview = Effect.fn("startInterview")(function* startInterview(
  userId: string,
  initialState: unknown,
) {
  const startedAt = yield* clockDate;
  const day = startedAt.toISOString().slice(0, dayLength);

  yield* query((database) =>
    database
      .insert(interview)
      .values({ day, state: initialState, updatedAt: startedAt, userId })
      .onConflictDoNothing(),
  );
});

export const countInterviewTurn = Effect.fn("countInterviewTurn")(function* countInterviewTurn(
  userId: string,
  limit: number,
) {
  const day = (yield* clockDate).toISOString().slice(0, dayLength);
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

export const storeInterview = Effect.fn("storeInterview")(function* storeInterview(stored: {
  readonly userId: string;
  readonly version: number;
  readonly savedSheet?: unknown;
  readonly state: unknown;
}) {
  const { userId, version, savedSheet, state } = stored;
  const updatedAt = yield* clockDate;
  const interviewContent = savedSheet === undefined ? { state } : { savedSheet, state };

  const [storedVersion] = yield* query((database) =>
    database
      .update(interview)
      .set({ ...interviewContent, updatedAt, version: version + 1 })
      .where(and(eq(interview.userId, userId), eq(interview.version, version)))
      .returning({ version: interview.version }),
  );
  if (storedVersion === undefined) {
    return yield* new InterviewConflict();
  }
});

export { InterviewConflict } from "./interview-conflict.ts";
export { InterviewLimitReached } from "./interview-limit-reached.ts";
