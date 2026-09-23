import { workerCompatibility } from "@repo/config/worker";
import { Effect } from "effect";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { unstable_dev } from "wrangler";

import { coldStartFixturePath } from "./cold-start-fixture.ts";

const concurrentRequests = 4;
const okStatus = 200;

function settled(request: Promise<unknown>): Promise<string> {
  return request.then(
    () => "answered",
    () => "cut off",
  );
}

function startedWorker(): Promise<Awaited<ReturnType<typeof unstable_dev>>> {
  return Effect.runPromise(
    Effect.gen(function* startedWorkerProgram() {
      const worker = yield* Effect.promise(() =>
        unstable_dev(coldStartFixturePath(), {
          compatibilityDate: workerCompatibility.date,
          compatibilityFlags: [...workerCompatibility.flags],
          experimental: { disableExperimentalWarning: true },
          logLevel: "none",
        }),
      );
      onTestFinished(() => worker.stop());
      return worker;
    }),
  );
}

describe("a worker whose runtime is still building its layer", () => {
  it("answers every request that arrives before the build finishes", () => {
    expect.hasAssertions();
    return Effect.runPromise(
      Effect.gen(function* concurrentAnswers() {
        const worker = yield* Effect.promise(() => startedWorker());
        const responses = yield* Effect.promise(() =>
          Promise.all(
            Array.from({ length: concurrentRequests }, () =>
              worker
                .fetch("/")
                .then((response) => response.text().then((text) => `${response.status} ${text}`)),
            ),
          ),
        );
        expect(responses).toStrictEqual(
          Array.from({ length: concurrentRequests }, () => "200 built"),
        );
      }),
    );
  });

  it("answers the second request after the one that started the build was cut off", () => {
    expect.hasAssertions();
    const cutOff = new AbortController();
    return Effect.runPromise(
      Effect.gen(function* cutOffThenRetry() {
        const worker = yield* Effect.promise(() => startedWorker());
        const abandoned = settled(worker.fetch("/", { signal: cutOff.signal }));
        yield* Effect.sleep("0 millis");
        const waiting = worker.fetch("/");
        cutOff.abort();
        const second = yield* Effect.promise(() => waiting);
        expect([
          yield* Effect.promise(() => abandoned),
          second.status,
          yield* Effect.promise(() => second.text()),
        ]).toStrictEqual(["cut off", okStatus, "built"]);
      }),
    );
  });
});
