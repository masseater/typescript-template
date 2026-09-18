import type { BrowserEvent } from "./events.ts";
import { maximumBatchSize } from "./events.ts";

type Deliver = (events: readonly BrowserEvent[]) => Promise<void>;
interface EventQueue {
  readonly disposed: boolean;
  readonly enqueue: (event: BrowserEvent) => void;
  readonly flushInBackground: () => void;
  readonly flushBeforeUnload: () => void;
}

const maximumPendingEvents = 128;
const maximumDeliveryAttempts = 3;
const retryBackoffMilliseconds = 1000;
const maximumRetryBackoffMilliseconds = 60_000;
const backoffFactor = 2;

function backoffAfter(failures: number): number {
  return Math.min(
    retryBackoffMilliseconds * backoffFactor ** (failures - 1),
    maximumRetryBackoffMilliseconds,
  );
}

function logError(event: string): void {
  // oxlint-disable-next-line no-console
  console.error(JSON.stringify({ event }));
}

function reportFailure(): void {
  logError("browser.telemetry_export_failed");
}

async function settle(delivery: Readonly<Promise<void>>): Promise<void> {
  try {
    await delivery;
  } catch {
    reportFailure();
  }
}

class BrowserEventQueue implements EventQueue {
  private readonly deliver: Deliver;
  private readonly pending: BrowserEvent[] = [];
  private active: Promise<void> | undefined;
  private closed = false;
  private failures = 0;
  private retryAt = 0;

  public constructor(deliver: Deliver) {
    this.deliver = deliver;
  }

  public get disposed(): boolean {
    return this.closed;
  }

  public enqueue(event: BrowserEvent): void {
    if (this.closed) {
      return;
    }
    if (this.pending.length >= maximumPendingEvents) {
      logError("browser.telemetry_queue_full");
      return;
    }
    this.pending.push(event);
  }

  public async flush(): Promise<void> {
    this.active ??= this.drainOnce();
    await this.active;
  }

  public flushInBackground(): void {
    void settle(this.flush());
  }

  public flushBeforeUnload(): void {
    while (this.pending.length > 0) {
      void settle(this.deliver(this.pending.splice(0, maximumBatchSize)));
    }
  }

  public close(): void {
    this.closed = true;
  }

  private async drainOnce(): Promise<void> {
    try {
      await this.drain();
    } finally {
      this.active = undefined;
    }
  }

  private async drain(): Promise<void> {
    if (Date.now() < this.retryAt) {
      return;
    }
    const events = this.pending.splice(0, maximumBatchSize);
    if (events.length === 0) {
      return;
    }
    await this.attempt(events);
    await this.drain();
  }

  private async attempt(events: readonly BrowserEvent[]): Promise<void> {
    try {
      await this.deliver(events);
    } catch (error) {
      this.giveUpOrRetry(events);
      throw error;
    }
    this.failures = 0;
    this.retryAt = 0;
  }

  private giveUpOrRetry(events: readonly BrowserEvent[]): void {
    this.failures += 1;
    this.retryAt = Date.now() + backoffAfter(this.failures);
    if (this.failures < maximumDeliveryAttempts) {
      this.pending.unshift(...events);
      return;
    }
    this.failures = 0;
    logError("browser.telemetry_batch_dropped");
  }
}

export { BrowserEventQueue };
export type { EventQueue };
