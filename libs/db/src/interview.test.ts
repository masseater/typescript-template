import { assert, it } from "@effect/vitest";
import { countInterviewTurn, findInterview, startInterview, storeInterview } from "./interview.ts";
import { Effect } from "effect";
import { TestDatabase } from "./testing.ts";
import { addUser } from "./records-fixture.ts";

const LIMIT = 2;
const now = new Date(0);

it.effect("of two writers holding the same version only the first one is stored", () =>
  Effect.gen(function* program() {
    yield* addUser("member");
    yield* startInterview("member", { step: 0 }, { day: "2026-09-18", now });
    yield* storeInterview("member", { now, savedSheet: undefined, state: { step: 1 }, version: 0 });
    const late = yield* storeInterview("member", {
      now,
      savedSheet: undefined,
      state: { step: 2 },
      version: 0,
    }).pipe(Effect.flip);
    assert.strictEqual(late._tag, "InterviewConflict");
    assert.deepStrictEqual(yield* findInterview("member"), {
      // oxlint-disable-next-line unicorn/no-null
      savedSheet: null,
      state: { step: 1 },
      version: 1,
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("starting again keeps the conversation that already exists", () =>
  Effect.gen(function* program() {
    yield* addUser("member");
    yield* startInterview("member", { step: 0 }, { day: "2026-09-18", now });
    yield* startInterview("member", { step: 9 }, { day: "2026-09-18", now });
    assert.deepStrictEqual((yield* findInterview("member"))?.state, { step: 0 });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("turns are counted per day and refused beyond the limit", () =>
  Effect.gen(function* program() {
    yield* addUser("member");
    yield* startInterview("member", {}, { day: "2026-09-18", now });
    yield* countInterviewTurn("member", "2026-09-18", LIMIT);
    yield* countInterviewTurn("member", "2026-09-18", LIMIT);
    const refused = yield* countInterviewTurn("member", "2026-09-18", LIMIT).pipe(Effect.flip);
    assert.strictEqual(refused._tag, "InterviewLimitReached");
    yield* countInterviewTurn("member", "2026-09-19", LIMIT);
    const missing = yield* countInterviewTurn("stranger", "2026-09-19", LIMIT).pipe(Effect.flip);
    assert.strictEqual(missing._tag, "InterviewLimitReached");
  }).pipe(Effect.provide(TestDatabase)),
);
