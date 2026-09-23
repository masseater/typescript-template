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
            epochMilliseconds: entropy.epochMilliseconds(),
            monotonicMilliseconds: entropy.monotonicMilliseconds(),
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

  describe("a read outside a fiber", () => {
    const it = test
      .extend("epochWithinHostClock", () => {
        const epochBefore = Date.now();
        const epochMilliseconds = RequestEntropy.defaultValue().epochMilliseconds();
        return epochBefore <= epochMilliseconds && epochMilliseconds <= Date.now();
      })
      .extend("monotonicWithinHostClock", () => {
        const monotonicBefore = performance.now();
        const monotonicMilliseconds = RequestEntropy.defaultValue().monotonicMilliseconds();
        return (
          monotonicBefore <= monotonicMilliseconds && monotonicMilliseconds <= performance.now()
        );
      });

    it("falls back to the host wall clock", ({ epochWithinHostClock }) => {
      expect(epochWithinHostClock).toBe(true);
    });

    it("falls back to the host monotonic clock", ({ monotonicWithinHostClock }) => {
      expect(monotonicWithinHostClock).toBe(true);
    });
  });
});
