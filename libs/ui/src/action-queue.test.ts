import { describe, expect, it } from "vite-plus/test";

import { makeActionQueue } from "./action-queue.ts";

const whenIdle = (queue: ReturnType<typeof makeActionQueue>): Promise<void> => {
  if (!queue.status().pending) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const stop = queue.subscribe((status) => {
      if (!status.pending) {
        stop();
        resolve();
      }
    });
  });
};

describe("action queue", () => {
  it("runs enqueued tasks in order without dropping them while pending", async () => {
    expect.hasAssertions();
    const queue = makeActionQueue();
    const seen: number[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    queue.run(async () => {
      await firstGate;
      seen.push(1);
    });
    queue.run(async () => {
      seen.push(2);
    });
    queue.run(async () => {
      seen.push(3);
    });

    expect(queue.status().pending).toBe(true);
    expect(seen).toEqual([]);
    releaseFirst();
    await whenIdle(queue);

    expect(seen).toEqual([1, 2, 3]);
    expect(queue.status()).toEqual({ error: undefined, pending: false });
  });

  it("keeps draining after a task fails and keeps that error until a later success", async () => {
    expect.hasAssertions();
    const queue = makeActionQueue();
    const seen: string[] = [];

    queue.run(async () => {
      seen.push("a");
      throw new Error("boom");
    });
    await whenIdle(queue);
    expect(seen).toEqual(["a"]);
    expect(queue.status().error).toBe("boom");

    queue.run(async () => {
      seen.push("b");
    });
    await whenIdle(queue);

    expect(seen).toEqual(["a", "b"]);
    expect(queue.status()).toEqual({ error: undefined, pending: false });
  });

  it("notifies subscribers when pending flips", async () => {
    expect.hasAssertions();
    const queue = makeActionQueue();
    const pendings: boolean[] = [];
    queue.subscribe((status) => {
      pendings.push(status.pending);
    });

    queue.run(async () => undefined);
    await whenIdle(queue);

    expect(pendings[0]).toBe(true);
    expect(pendings.at(-1)).toBe(false);
  });
});
