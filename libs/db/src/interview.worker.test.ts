import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { countInterviewTurn, findInterview, startInterview, storeInterview } from "./interview.ts";
import { TestDatabase, runStatement } from "./testing.ts";

const LIMIT = 2;
const TWICE_STORED = 2;

function addMember(id: string): Effect.Effect<unknown, unknown> {
  return runStatement(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
    id,
    id,
    `${id}@example.com`,
  );
}

it.effect("of two writers holding the same version only the first one is stored", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    yield* startInterview("member", { step: 0 });
    yield* storeInterview({ state: { step: 1 }, userId: "member", version: 0 });
    const late = yield* storeInterview({ state: { step: 2 }, userId: "member", version: 0 }).pipe(
      Effect.flip,
    );
    assert.strictEqual(late._tag, "InterviewConflict");
    assert.deepStrictEqual(yield* findInterview("member"), {
      // oxlint-disable-next-line unicorn/no-null
      savedSheet: null,
      state: { step: 1 },
      version: 1,
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("the saved sheet stays until a write names it", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    yield* startInterview("member", { step: 0 });
    yield* storeInterview({
      savedSheet: { nickname: "たろう" },
      state: { step: 1 },
      userId: "member",
      version: 0,
    });
    yield* storeInterview({ state: { step: 2 }, userId: "member", version: 1 });
    assert.deepStrictEqual(yield* findInterview("member"), {
      savedSheet: { nickname: "たろう" },
      state: { step: 2 },
      version: TWICE_STORED,
    });
    // oxlint-disable-next-line unicorn/no-null
    yield* storeInterview({
      savedSheet: null,
      state: { step: 3 },
      userId: "member",
      version: TWICE_STORED,
    });
    assert.isNull((yield* findInterview("member"))?.savedSheet);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("starting again keeps the conversation that already exists", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    yield* startInterview("member", { step: 0 });
    yield* startInterview("member", { step: 9 });
    assert.deepStrictEqual((yield* findInterview("member"))?.state, { step: 0 });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("turns are counted per day and refused beyond the limit", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
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
