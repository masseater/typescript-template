import { workerCompatibility } from "@repo/config/worker";
import { Effect } from "effect";
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
            Effect.promise(async () => {
              const answered = await worker.fetch();
              return `${String(answered.status)} ${await answered.text()}`;
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
        const cutOff = new AbortController();
        const abandoned = Promise.allSettled([worker.fetch(undefined, { signal: cutOff.signal })]);
        yield* Effect.sleep("0 millis");
        const waiting = worker.fetch();
        cutOff.abort();
        const [abandonedSettlement] = yield* Effect.promise(() => abandoned);
        const retried = yield* Effect.promise(() => waiting);
        return {
          abandoned: abandonedSettlement.status,
          retried: `${String(retried.status)} ${yield* Effect.promise(() => retried.text())}`,
        };
      }),
    ));

  it("answers the second request", ({ retriedAnswer }) => {
    expect(retriedAnswer).toStrictEqual({ abandoned: "rejected", retried: "200 built" });
  });
});
