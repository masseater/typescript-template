import type { LogRecord, Signal, SpanRecord, TelemetryRuntime } from "./protocol.ts";
import type { ExporterOptions } from "./otlp-delivery.ts";
import type { HistogramMetric } from "./metrics.ts";
import { createMetricAccumulator } from "./metrics.ts";
import { deliverWithRetry } from "./otlp-delivery.ts";
import { envelope } from "./protocol.ts";
import { logError } from "./log.ts";

type TelemetryRecord = HistogramMetric | LogRecord | SpanRecord;
interface Batch {
  readonly signal: Signal;
  readonly records: readonly TelemetryRecord[];
  readonly runtime: TelemetryRuntime;
}
interface ExecutionContext {
  readonly waitUntil: (promise: Readonly<Promise<unknown>>) => void;
}
interface Diagnostics {
  readonly droppedRecords: number;
  readonly exportFailures: number;
  readonly queuedBatches: number;
}
interface Exporter {
  readonly diagnostics: () => Diagnostics;
  readonly enqueue: (batch: Batch) => void;
  readonly flush: () => Promise<void>;
  readonly flushInBackground: (executionContext?: ExecutionContext) => void;
}

const maximumQueuedBatches = 192;
const flushBudgetMilliseconds = 20_000;
const accumulateMetrics = createMetricAccumulator();

class OtlpExporter implements Exporter {
  private readonly options: ExporterOptions;
  private queue: readonly Batch[] = [];
  private active: Promise<void> | undefined;
  private droppedRecords = 0;
  private exportFailures = 0;

  public constructor(options: ExporterOptions) {
    this.options = options;
  }

  public diagnostics(): Diagnostics {
    return {
      droppedRecords: this.droppedRecords,
      exportFailures: this.exportFailures,
      queuedBatches: this.queue.length,
    };
  }

  public enqueue(batch: Batch): void {
    if (this.queue.length >= maximumQueuedBatches) {
      this.droppedRecords += batch.records.length;
      logError({
        dropped_records: this.droppedRecords,
        event: "telemetry.queue_full",
        service: this.options.serviceName,
      });
      return;
    }
    this.queue = [...this.queue, batch];
  }

  public async flush(): Promise<void> {
    this.active ??= this.flushOnce();
    await this.active;
  }

  public flushInBackground(executionContext?: ExecutionContext): void {
    const promise = this.settleFlush();
    if (executionContext) {
      executionContext.waitUntil(promise);
    } else {
      void promise;
    }
  }

  private async settleFlush(): Promise<void> {
    try {
      await this.flush();
    } catch {
      logError({
        event: "telemetry.background_export_failed",
        export_failures: this.exportFailures,
        service: this.options.serviceName,
      });
    }
  }

  private async flushOnce(): Promise<void> {
    try {
      if (!(await this.drainSafely())) {
        this.exportFailures += 1;
        logError({
          event: "telemetry.export_failed",
          pending: this.queue.length,
          service: this.options.serviceName,
        });
        throw new Error("Telemetry export exhausted its retry budget; undelivered records dropped");
      }
    } finally {
      this.active = undefined;
    }
  }

  private async drainSafely(): Promise<boolean> {
    try {
      return await this.drain(Date.now() + flushBudgetMilliseconds);
    } catch {
      return false;
    }
  }

  private async drain(deadline: number): Promise<boolean> {
    const [batch] = this.queue;
    if (!batch) {
      return true;
    }
    const group = this.queue.filter(
      (item) => item.signal === batch.signal && item.runtime === batch.runtime,
    );
    const body = this.encode(batch, group);
    const delivered = await deliverWithRetry(this.options, {
      body,
      deadline,
      signal: batch.signal,
    });
    this.settle(group, delivered);
    const remaining = await this.drain(deadline);
    return delivered && remaining;
  }

  private settle(group: readonly Batch[], delivered: boolean): void {
    if (!delivered) {
      this.droppedRecords += group.reduce((total, item) => total + item.records.length, 0);
    }
    this.queue = this.queue.filter((item) => !group.includes(item));
  }

  private encode(batch: Batch, group: readonly Batch[]): string {
    const records = group.flatMap((item) => item.records);
    const exported =
      batch.signal === "metrics"
        ? accumulateMetrics(
            records.filter((record) => "histogram" in record),
            `${this.options.serviceName}-${batch.runtime}`,
            Date.now(),
          )
        : records;
    return JSON.stringify(
      envelope({
        records: exported,
        runtime: batch.runtime,
        service: this.options.serviceName,
        signal: batch.signal,
      }),
    );
  }
}

function createExporter(options: ExporterOptions): Exporter {
  return new OtlpExporter(options);
}

export { createExporter };
export type { Diagnostics, ExecutionContext, Exporter };
