import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { unstable_dev } from "wrangler";

import { workerCompatibility } from "@repo/config/worker";

import { coldStartFixturePath } from "./cold-start-fixture.ts";

const concurrentRequests = 4;
const abortAfter = 50;
const okStatus = 200;

async function settled(request: Promise<unknown>): Promise<string> {
  try {
    await request;
    return "answered";
  } catch {
    return "cut off";
  }
}

async function startedWorker(): Promise<Awaited<ReturnType<typeof unstable_dev>>> {
  const worker = await unstable_dev(coldStartFixturePath(), {
    compatibilityDate: workerCompatibility.date,
    compatibilityFlags: [...workerCompatibility.flags],
    experimental: { disableExperimentalWarning: true },
    logLevel: "none",
  });
  onTestFinished(async () => worker.stop());
  return worker;
}

describe("a worker whose runtime is still building its layer", () => {
  it("answers every request that arrives before the build finishes", async () => {
    expect.hasAssertions();
    const worker = await startedWorker();
    const responses = await Promise.all(
      Array.from({ length: concurrentRequests }, async () => {
        const response = await worker.fetch("/");
        return `${response.status} ${await response.text()}`;
      }),
    );
    expect(responses).toStrictEqual(Array.from({ length: concurrentRequests }, () => "200 built"));
  });

  it("answers the second request after the one that started the build was cut off", async () => {
    expect.hasAssertions();
    const worker = await startedWorker();
    const cutOff = new AbortController();
    const abandoned = settled(worker.fetch("/", { signal: cutOff.signal }));
    const waiting = worker.fetch("/");
    setTimeout(() => {
      cutOff.abort();
    }, abortAfter);
    const second = await waiting;
    expect([await abandoned, second.status, await second.text()]).toStrictEqual([
      "cut off",
      okStatus,
      "built",
    ]);
  });
});
