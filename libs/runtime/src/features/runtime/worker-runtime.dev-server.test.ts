import { workerCompatibility } from "@repo/config/worker";
import { Effect, Exit, Fiber, Scope } from "effect";
import { describe, expect, test } from "vite-plus/test";
import { unstable_dev } from "wrangler";

import { coldStartFixturePath } from "./cold-start-fixture.ts";

describe("a worker whose runtime is still building its layer", () => {
  const it = test.extend("concurrentAnswers", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* concurrentAnswersProgram() {
        const worker = yield* Effect.promise(() =>
          unstable_dev(coldStartFixturePath(), {
            compatibilityDate: workerCompatibility.date,
            compatibilityFlags: [...workerCompatibility.flags],
            experimental: { disableExperimentalWarning: true },
            logLevel: "none",
          }),
        );
        onCleanup(() => worker.stop());
        return yield* Effect.forEach(
          ["first", "second", "third", "fourth"],
          () =>
            Effect.gen(function* answerProgram() {
              const answered = yield* Effect.promise(() => worker.fetch());
              return `${String(answered.status)} ${yield* Effect.promise(() => answered.text())}`;
            }),
          { concurrency: "unbounded" },
        );
      }),
    ));

  it("answers every request that arrives before the build finishes", ({ concurrentAnswers }) => {
    expect(concurrentAnswers).toStrictEqual(["200 built", "200 built", "200 built", "200 built"]);
  });
});

describe("a worker whose first request was cut off while its layer was building", () => {
  const it = test.extend("retriedAnswer", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* retriedAnswerProgram() {
        const worker = yield* Effect.promise(() =>
          unstable_dev(coldStartFixturePath(), {
            compatibilityDate: workerCompatibility.date,
            compatibilityFlags: [...workerCompatibility.flags],
            experimental: { disableExperimentalWarning: true },
            logLevel: "none",
          }),
        );
        onCleanup(() => worker.stop());
        const cutOff = yield* Scope.make();
        const signal = yield* Scope.provide(Effect.abortSignal, cutOff);
        const abandoned = yield* Effect.tryPromise(() => worker.fetch(undefined, { signal })).pipe(
          Effect.match({ onFailure: () => "rejected", onSuccess: () => "fulfilled" }),
          Effect.forkChild({ startImmediately: true }),
        );
        yield* Effect.sleep("0 millis");
        const waiting = yield* Effect.promise(() => worker.fetch()).pipe(
          Effect.forkChild({ startImmediately: true }),
        );
        yield* Scope.close(cutOff, Exit.void);
        const abandonedSettlement = yield* Fiber.join(abandoned);
        const retried = yield* Fiber.join(waiting);
        return {
          abandoned: abandonedSettlement,
          retried: `${String(retried.status)} ${yield* Effect.promise(() => retried.text())}`,
        };
      }),
    ));

  it("answers the second request", ({ retriedAnswer }) => {
    expect(retriedAnswer).toStrictEqual({ abandoned: "rejected", retried: "200 built" });
  });
});
