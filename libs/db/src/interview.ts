import { and, eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { InterviewConflict } from "./interview-conflict.ts";
import { InterviewLimitReached } from "./interview-limit-reached.ts";
import { interview } from "./schema.ts";
import { query } from "./database.ts";

interface InterviewMoment {
  readonly day: string;
  readonly now: Date;
}

interface InterviewRevision {
  readonly now: Date;
  readonly savedSheet: unknown;
  readonly state: unknown;
  readonly version: number;
}

const recordColumns = {
  savedSheet: interview.savedSheet,
  state: interview.state,
  version: interview.version,
};

const findInterview = Effect.fn("findInterview")(function* findInterview(userId: string) {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [record] = yield* query((database) =>
    database.select(recordColumns).from(interview).where(eq(interview.userId, userId)).limit(1),
  );
  // oxlint-disable-next-line unicorn/no-null
  return record ?? null;
});

const startInterview = Effect.fn("startInterview")(function* startInterview(
  userId: string,
  state: unknown,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  moment: InterviewMoment,
) {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  yield* query((database) =>
    database
      .insert(interview)
      .values({ day: moment.day, state, updatedAt: moment.now, userId })
      .onConflictDoNothing(),
  );
});

const countInterviewTurn = Effect.fn("countInterviewTurn")(function* countInterviewTurn(
  userId: string,
  day: string,
  limit: number,
) {
  const turns = sql<number>`CASE WHEN ${interview.day} = ${day} THEN ${interview.turns} + 1 ELSE 1 END`;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  revision: InterviewRevision,
) {
  const { now, savedSheet, state, version } = revision;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [stored] = yield* query((database) =>
    database
      .update(interview)
      .set({ savedSheet, state, updatedAt: now, version: version + 1 })
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
