import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, test } from "vite-plus/test";

import { RequestEntropy } from "./request-span.ts";

const fixedNow = 1_800_000_000_000;

describe("RequestEntropy", () => {
  describe("a clock moved to a fixed instant", () => {
    const it = test.extend("clockReading", () =>
      Effect.runPromise(
        Effect.gen(function* readClock() {
          yield* TestClock.setTime(fixedNow);
          const entropy = yield* RequestEntropy;
          return {
            epochMilliseconds: yield* entropy.epochMilliseconds,
            monotonicMilliseconds: yield* entropy.monotonicMilliseconds,
          };
        }).pipe(Effect.provide(TestClock.layer())),
      ));

    it("reads that instant from the Effect clock", ({ clockReading }) => {
      expect(clockReading).toStrictEqual({
        epochMilliseconds: fixedNow,
        monotonicMilliseconds: fixedNow,
      });
    });
  });
});
