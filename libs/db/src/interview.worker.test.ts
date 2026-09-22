import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, test } from "vite-plus/test";

import { countInterviewTurn, findInterview, startInterview, storeInterview } from "./interview.ts";
import { TestDatabase, runStatement } from "./testing.ts";

const LIMIT = 2;
const TWICE_STORED = 2;

describe("interview concurrency", () => {
  const it = test.extend("storedInterview", async () =>
    Effect.runPromise(
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
        return {
          lateTag: late._tag,
          saved: yield* findInterview("member"),
        };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("of two writers holding the same version only the first one is stored", ({
    storedInterview,
  }) => {
    expect(storedInterview).toStrictEqual({
      lateTag: "InterviewConflict",
      saved: { savedSheet: null, state: { step: 1 }, version: 1 },
    });
  });
});

describe("interview saved sheet", () => {
  const it = test.extend("sheetLifecycle", async () =>
    Effect.runPromise(
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
        return { clearedSheet: cleared?.savedSheet ?? null, kept };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("the saved sheet stays until a write names it", ({ sheetLifecycle }) => {
    expect(sheetLifecycle).toStrictEqual({
      clearedSheet: null,
      kept: {
        savedSheet: { nickname: "たろう" },
        state: { step: 2 },
        version: TWICE_STORED,
      },
    });
  });
});

describe("interview restart", () => {
  const it = test.extend("conversationState", async () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        yield* runStatement(
          "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
          "member",
          "member",
          "member@example.com",
        );
        yield* startInterview("member", { step: 0 });
        yield* startInterview("member", { step: 9 });
        return (yield* findInterview("member"))?.state;
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("starting again keeps the conversation that already exists", ({ conversationState }) => {
    expect(conversationState).toStrictEqual({ step: 0 });
  });
});

describe("interview turn limits", () => {
  const it = test.extend("turnLimitTags", async () =>
    Effect.runPromise(
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
        return { missingTag: missing._tag, refusedTag: refused._tag };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("turns are counted per day and refused beyond the limit", ({ turnLimitTags }) => {
    expect(turnLimitTags).toStrictEqual({
      missingTag: "InterviewLimitReached",
      refusedTag: "InterviewLimitReached",
    });
  });
});
