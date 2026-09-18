import { describe, expect, it } from "vite-plus/test";
import { captureObservers } from "./browser-observers.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { setTimeout as wait } from "node:timers/promises";

const settleMilliseconds = 50;

function observeMarks(): string[] {
  const observed: string[] = [];
  const observer = new PerformanceObserver((list) => {
    observed.push(...list.getEntries().map((entry) => entry.name));
  });
  observer.observe({ entryTypes: ["mark"] });
  return observed;
}

async function markAndSettle(name: string): Promise<void> {
  performance.mark(name);
  await wait(settleMilliseconds);
}

describe("performance observers", () => {
  it("telemetry が動いている間に張られた observer は解除で止まる", async () => {
    expect.hasAssertions();
    const original = globalThis.PerformanceObserver;
    const stopCapturing = captureObservers();
    const observed = observeMarks();
    await markAndSettle("vital.before_dispose");
    stopCapturing();
    await markAndSettle("vital.after_dispose");
    expect(observed).toContain("vital.before_dispose");
    expect(observed).not.toContain("vital.after_dispose");
    expect(globalThis.PerformanceObserver).toBe(original);
  });
});
