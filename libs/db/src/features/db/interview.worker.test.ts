import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { TestDatabase, runStatement } from "./database-test-fixture.ts";
import { countInterviewTurn, findInterview, startInterview, storeInterview } from "./interview.ts";

const LIMIT = 2;
const TWICE_STORED = 2;

layer(TestDatabase)("interview concurrency", (it) => {
  it.effect("of two writers holding the same version only the first one is stored", () =>
    Effect.gen(function* program() {
      yield* runStatement(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
        "member",
        "member",
        "member@example.com",
      );
      yield* startInterview("member", { step: 0 });
      yield* storeInterview({ state: { step: 1 }, userId: "member", version: 0 });
      const late = yield* storeInterview({
        state: { step: 2 },
        userId: "member",
        version: 0,
      }).pipe(Effect.flip);
      assert.deepStrictEqual(
        { lateTag: late._tag, saved: yield* findInterview("member") },
        {
          lateTag: "InterviewConflict",
          saved: { savedSheet: null, state: { step: 1 }, version: 1 },
        },
      );
    }),
  );
});

layer(TestDatabase)("interview saved sheet", (it) => {
  it.effect("the saved sheet stays until a write names it", () =>
    Effect.gen(function* program() {
      yield* runStatement(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
        "member",
        "member",
        "member@example.com",
      );
      yield* startInterview("member", { step: 0 });
      yield* storeInterview({
        savedSheet: { nickname: "たろう" },
        state: { step: 1 },
        userId: "member",
        version: 0,
      });
      yield* storeInterview({ state: { step: 2 }, userId: "member", version: 1 });
      const kept = yield* findInterview("member");
      yield* storeInterview({
        savedSheet: null,
        state: { step: 3 },
        userId: "member",
        version: TWICE_STORED,
      });
      const cleared = yield* findInterview("member");
      assert.deepStrictEqual(
        { clearedSheet: cleared?.savedSheet ?? null, kept },
        {
          clearedSheet: null,
          kept: {
            savedSheet: { nickname: "たろう" },
            state: { step: 2 },
            version: TWICE_STORED,
          },
        },
      );
    }),
  );
});

layer(TestDatabase)("interview restart", (it) => {
  it.effect("starting again keeps the conversation that already exists", () =>
    Effect.gen(function* program() {
      yield* runStatement(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
        "member",
        "member",
        "member@example.com",
      );
      yield* startInterview("member", { step: 0 });
      yield* startInterview("member", { step: 9 });
      assert.deepStrictEqual((yield* findInterview("member"))?.state, { step: 0 });
    }),
  );
});

layer(TestDatabase)("interview turn limits", (it) => {
  it.effect("turns are counted per day and refused beyond the limit", () =>
    Effect.gen(function* program() {
      yield* runStatement(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
        "member",
        "member",
        "member@example.com",
      );
      yield* startInterview("member", {});
      yield* countInterviewTurn("member", LIMIT);
      yield* countInterviewTurn("member", LIMIT);
      const refused = yield* countInterviewTurn("member", LIMIT).pipe(Effect.flip);
      yield* TestClock.adjust("1 day");
      yield* countInterviewTurn("member", LIMIT);
      const missing = yield* countInterviewTurn("stranger", LIMIT).pipe(Effect.flip);
      assert.deepStrictEqual(
        { missingTag: missing._tag, refusedTag: refused._tag },
        { missingTag: "InterviewLimitReached", refusedTag: "InterviewLimitReached" },
      );
    }).pipe(Effect.provide(TestClock.layer())),
  );
});
