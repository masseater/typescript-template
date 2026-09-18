// oxlint-disable-next-line import/no-nodejs-modules
import { setTimeout as wait } from "node:timers/promises";

import { describe, expect, it } from "vite-plus/test";

import { BrowserEventQueue } from "./browser-queue.ts";
import { randomHex } from "./protocol.ts";

import type { BrowserEvent } from "./events.ts";

const maximumDeliveryAttempts = 3;
const retryBackoffMilliseconds = 1000;
const spanIdBytes = 8;
const traceIdBytes = 16;
const secondAttempt = 2;
const settleMilliseconds = 50;

function vitalEvent(): BrowserEvent {
  return {
    duration: 0,
    kind: "vital",
    method: "GET",
    name: "INP",
    requestId: crypto.randomUUID(),
    route: "home",
    spanId: randomHex(spanIdBytes),
    start: Date.now(),
    status: 0,
    traceId: randomHex(traceIdBytes),
    value: 1,
  };
}

function refusedDeliveries(): {
  readonly batches: (readonly BrowserEvent[])[];
  readonly queue: BrowserEventQueue;
} {
  const batches: (readonly BrowserEvent[])[] = [];
  const queue = new BrowserEventQueue(async (events) => {
    batches.push(events);
    throw new Error("delivery refused");
  });
  return { batches, queue };
}

async function attemptFlush(queue: Readonly<BrowserEventQueue>): Promise<boolean> {
  try {
    await queue.flush();
    return true;
  } catch {
    return false;
  }
}

async function exhaustAttempts(queue: Readonly<BrowserEventQueue>): Promise<void> {
  await attemptFlush(queue);
  await wait(retryBackoffMilliseconds);
  await attemptFlush(queue);
  await wait(retryBackoffMilliseconds * secondAttempt);
  await attemptFlush(queue);
}

describe("browser event queue", () => {
  it("配送に失敗したバッチは間隔を空けるまで再送しない", async () => {
    expect.hasAssertions();
    const { batches, queue } = refusedDeliveries();
    queue.enqueue(vitalEvent());
    await attemptFlush(queue);
    await attemptFlush(queue);
    expect(batches).toHaveLength(1);
    await wait(retryBackoffMilliseconds);
    await attemptFlush(queue);
    expect(batches).toHaveLength(secondAttempt);
  });

  it("再送は上限で打ち切られ、同じイベントを送り続けない", async () => {
    expect.hasAssertions();
    const { batches, queue } = refusedDeliveries();
    const event = vitalEvent();
    queue.enqueue(event);
    await exhaustAttempts(queue);
    queue.flushBeforeUnload();
    await wait(settleMilliseconds);
    expect(batches).toHaveLength(maximumDeliveryAttempts);
    expect([...new Set(batches.flat().map((delivered) => delivered.spanId))]).toStrictEqual([
      event.spanId,
    ]);
  });
});
