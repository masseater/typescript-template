import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, test } from "vite-plus/test";

import {
  InterviewConflict,
  InterviewLimitReached,
  countInterviewTurn,
  findInterview,
  startInterview,
  storeInterview,
} from "./interview.ts";
import { addUser, runTest, TestDatabase } from "./testing.ts";

const withClock = Layer.merge(TestDatabase, TestClock.layer());

describe("storeInterview", () => {
  describe("a second writer holding a version that was already stored", () => {
    const it = test.extend("lateWrite", async () =>
      runTest(
        Effect.gen(function* raceWriters() {
          yield* addUser({ userId: "member" });
          yield* startInterview("member", { step: 0 });
          yield* storeInterview({ state: { step: 1 }, userId: "member", version: 0 });
          return yield* Effect.flip(
            storeInterview({ state: { step: 2 }, userId: "member", version: 0 }),
          );
        }),
      ));

    it("is refused as a conflict", ({ lateWrite }) => {
      expect(lateWrite).toStrictEqual(new InterviewConflict());
    });
  });

  describe("the interview after a refused second writer", () => {
    const it = test.extend("storedInterview", async () =>
      runTest(
        Effect.gen(function* raceWriters() {
          yield* addUser({ userId: "member" });
          yield* startInterview("member", { step: 0 });
          yield* storeInterview({ state: { step: 1 }, userId: "member", version: 0 });
          yield* Effect.exit(storeInterview({ state: { step: 2 }, userId: "member", version: 0 }));
          return yield* findInterview("member");
        }),
      ));

    it("keeps what the first writer stored", ({ storedInterview }) => {
      expect(storedInterview).toStrictEqual({ savedSheet: null, state: { step: 1 }, version: 1 });
    });
  });

  describe("a write that does not name the saved sheet", () => {
    const it = test.extend("storedInterview", async () =>
      runTest(
        Effect.gen(function* keepSheet() {
          yield* addUser({ userId: "member" });
          yield* startInterview("member", { step: 0 });
          yield* storeInterview({
            savedSheet: { nickname: "たろう" },
            state: { step: 1 },
            userId: "member",
            version: 0,
          });
          yield* storeInterview({ state: { step: 2 }, userId: "member", version: 1 });
          return yield* findInterview("member");
        }),
      ));

    it("keeps the sheet saved before it", ({ storedInterview }) => {
      expect(storedInterview).toStrictEqual({
        savedSheet: { nickname: "たろう" },
        state: { step: 2 },
        version: 2,
      });
    });
  });

  describe("a write that clears the saved sheet", () => {
    const it = test.extend("storedInterview", async () =>
      runTest(
        Effect.gen(function* clearSheet() {
          yield* addUser({ userId: "member" });
          yield* startInterview("member", { step: 0 });
          yield* storeInterview({
            savedSheet: { nickname: "たろう" },
            state: { step: 1 },
            userId: "member",
            version: 0,
          });
          yield* storeInterview({
            savedSheet: null,
            state: { step: 2 },
            userId: "member",
            version: 1,
          });
          return yield* findInterview("member");
        }),
      ));

    it("leaves no saved sheet", ({ storedInterview }) => {
      expect(storedInterview).toStrictEqual({ savedSheet: null, state: { step: 2 }, version: 2 });
    });
  });
});

describe("startInterview", () => {
  describe("starting again over a conversation that exists", () => {
    const it = test.extend("storedInterview", async () =>
      runTest(
        Effect.gen(function* startTwice() {
          yield* addUser({ userId: "member" });
          yield* startInterview("member", { step: 0 });
          yield* startInterview("member", { step: 9 });
          return yield* findInterview("member");
        }),
      ));

    it("keeps the conversation that already exists", ({ storedInterview }) => {
      expect(storedInterview).toStrictEqual({ savedSheet: null, state: { step: 0 }, version: 0 });
    });
  });
});

describe("countInterviewTurn", () => {
  describe("a third turn on a day that allows two", () => {
    const it = test.extend("refusal", async () =>
      runTest(
        Effect.gen(function* countThree() {
          yield* addUser({ userId: "member" });
          yield* startInterview("member", {});
          yield* countInterviewTurn("member", 2);
          yield* countInterviewTurn("member", 2);
          return yield* Effect.flip(countInterviewTurn("member", 2));
        }),
        withClock,
      ));

    it("is refused", ({ refusal }) => {
      expect(refusal).toStrictEqual(new InterviewLimitReached());
    });
  });

  describe("a turn on the next day after the limit was reached", () => {
    const it = test.extend("nextDayTurn", async () =>
      runTest(
        Effect.gen(function* countNextDay() {
          yield* addUser({ userId: "member" });
          yield* startInterview("member", {});
          yield* countInterviewTurn("member", 2);
          yield* countInterviewTurn("member", 2);
          yield* TestClock.adjust("1 day");
          return yield* countInterviewTurn("member", 2);
        }),
        withClock,
      ));

    it("is counted afresh without a refusal", ({ nextDayTurn }) => {
      expect(nextDayTurn).toBe(undefined);
    });
  });

  describe("a turn for someone who never started an interview", () => {
    const it = test.extend("refusal", async () =>
      runTest(Effect.flip(countInterviewTurn("stranger", 2))));

    it("is refused", ({ refusal }) => {
      expect(refusal).toStrictEqual(new InterviewLimitReached());
    });
  });
});
