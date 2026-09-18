import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { unstable_dev } from "wrangler";

import { workerCompatibility } from "@repo/config/worker";

import { coldStartFixturePath } from "./cold-start-fixture.ts";

const concurrentRequests = 4;

describe("a worker whose runtime is still building its layer", () => {
  it("answers every request that arrives before the build finishes", async () => {
    expect.hasAssertions();
    const worker = await unstable_dev(coldStartFixturePath(), {
      compatibilityDate: workerCompatibility.date,
      compatibilityFlags: [...workerCompatibility.flags],
      experimental: { disableExperimentalWarning: true },
      logLevel: "none",
    });
    onTestFinished(async () => worker.stop());
    const responses = await Promise.all(
      Array.from({ length: concurrentRequests }, async () => {
        const response = await worker.fetch("/");
        return `${response.status} ${await response.text()}`;
      }),
    );
    expect(responses).toStrictEqual(Array.from({ length: concurrentRequests }, () => "200 built"));
  });
});
