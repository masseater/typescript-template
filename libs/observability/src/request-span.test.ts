import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, test } from "vite-plus/test";

import { RequestEntropy } from "./request-span.ts";

const fixedNow = 1_800_000_000_000;

describe("RequestEntropy", () => {
  describe("a clock moved to a fixed instant", () => {
    const it = test.extend("time", async () =>
      Effect.runPromise(
        Effect.gen(function* readClock() {
          yield* TestClock.setTime(fixedNow);
          const entropy = yield* RequestEntropy;
          return {
            epochMilliseconds: entropy.epochMilliseconds(),
            monotonicMilliseconds: entropy.monotonicMilliseconds(),
          };
        }).pipe(Effect.provide(TestClock.layer())),
      ));

    it("reads that instant from the Effect clock", ({ time }) => {
      expect(time).toStrictEqual({
        epochMilliseconds: fixedNow,
        monotonicMilliseconds: fixedNow,
      });
    });
  });

  describe("a read outside a fiber", () => {
    const it = test.extend("time", () => RequestEntropy.defaultValue());

    it("refuses to invent a timestamp", ({ time }) => {
      expect(() => time.epochMilliseconds()).toThrow(/fiber/u);
      expect(() => time.monotonicMilliseconds()).toThrow(/fiber/u);
    });
  });
});
