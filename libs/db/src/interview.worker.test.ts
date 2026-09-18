import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { countInterviewTurn, findInterview, startInterview, storeInterview } from "./interview.ts";
import { addUser } from "./records-fixture.ts";
import { TestDatabase } from "./testing.ts";

const LIMIT = 2;
const TWICE_STORED = 2;

it.effect("of two writers holding the same version only the first one is stored", () =>
  Effect.gen(function* program() {
    yield* addUser("member");
    yield* startInterview("member", { step: 0 });
    yield* storeInterview("member", 0, { state: { step: 1 } });
    const late = yield* storeInterview("member", 0, { state: { step: 2 } }).pipe(Effect.flip);
    assert.strictEqual(late._tag, "InterviewConflict");
    assert.deepStrictEqual(yield* findInterview("member"), {
      savedSheet: null,
      state: { step: 1 },
      version: 1,
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("the saved sheet stays until a write names it", () =>
  Effect.gen(function* program() {
    yield* addUser("member");
    yield* startInterview("member", { step: 0 });
    yield* storeInterview("member", 0, { savedSheet: { nickname: "たろう" }, state: { step: 1 } });
    yield* storeInterview("member", 1, { state: { step: 2 } });
    assert.deepStrictEqual(yield* findInterview("member"), {
      savedSheet: { nickname: "たろう" },
      state: { step: 2 },
      version: TWICE_STORED,
    });

    yield* storeInterview("member", TWICE_STORED, { savedSheet: null, state: { step: 3 } });
    assert.isNull((yield* findInterview("member"))?.savedSheet);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("starting again keeps the conversation that already exists", () =>
  Effect.gen(function* program() {
    yield* addUser("member");
    yield* startInterview("member", { step: 0 });
    yield* startInterview("member", { step: 9 });
    assert.deepStrictEqual((yield* findInterview("member"))?.state, { step: 0 });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("turns are counted per day and refused beyond the limit", () =>
  Effect.gen(function* program() {
    yield* addUser("member");
    yield* startInterview("member", {});
    yield* countInterviewTurn("member", LIMIT);
    yield* countInterviewTurn("member", LIMIT);
    const refused = yield* countInterviewTurn("member", LIMIT).pipe(Effect.flip);
    assert.strictEqual(refused._tag, "InterviewLimitReached");
    yield* TestClock.adjust("1 day");
    yield* countInterviewTurn("member", LIMIT);
    const missing = yield* countInterviewTurn("stranger", LIMIT).pipe(Effect.flip);
    assert.strictEqual(missing._tag, "InterviewLimitReached");
  }).pipe(Effect.provide(TestDatabase)),
);
