import type { RequestContext, Telemetry, Timing } from "./telemetry.ts";
import { durationMetric, enqueueServer, traceparent } from "./telemetry.ts";
import { logRecord, randomHex, spanIdBytes, spanKind, spanRecord } from "./protocol.ts";
import type { Correlation } from "./protocol.ts";
import { externalAttributes } from "./external.ts";
import { httpStatus } from "./http-status.ts";

type DbOperation = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "MIGRATE" | "TRANSACTION" | "OTHER";
type ExternalOperation = "email" | "ai";
interface ChildObservation extends Timing {
  readonly child: Correlation;
  readonly parentSpanId: string;
  readonly failed: boolean;
}
interface ChildSpan<Action> {
  readonly context: RequestContext;
  readonly action: Action;
}
interface ChildStart {
  readonly spanId: string;
  readonly start: number;
  readonly timer: number;
}

function startChild(): ChildStart {
  return { spanId: randomHex(spanIdBytes), start: Date.now(), timer: performance.now() };
}

function recordExternal(
  telemetry: Telemetry,
  operation: ExternalOperation,
  observation: ChildObservation & { readonly status: number | undefined },
): void {
  const { child, duration, failed, parentSpanId, start } = observation;
  const end = start + duration;
  const values = externalAttributes(operation, observation.status, failed);
  const name = `external.${operation}`;
  const kind = spanKind.client;
  const logValues = { ...values, "duration.ms": duration };
  const timing = { ...observation, context: child };
  enqueueServer(telemetry, [
    {
      record: spanRecord({ context: child, end, failed, kind, name, parentSpanId, start, values }),
      signal: "traces",
    },
    {
      record: logRecord({ context: child, failed, name, time: end, values: logValues }),
      signal: "logs",
    },
    { record: durationMetric("external.request.duration", values, timing), signal: "metrics" },
  ]);
}

async function withExternalSpan<Result>(
  telemetry: Telemetry,
  operation: ExternalOperation,
  span: ChildSpan<(context: RequestContext) => Promise<Result>>,
): Promise<Result> {
  const { spanId, start, timer } = startChild();
  const child = { ...span.context, spanId, traceparent: traceparent(span.context.traceId, spanId) };
  const outcome: { failed: boolean; status: number | undefined } = {
    failed: true,
    status: undefined,
  };
  try {
    const result = await span.action(child);
    outcome.status = result instanceof Response ? result.status : undefined;
    outcome.failed = outcome.status !== undefined && outcome.status >= httpStatus.badRequest;
    return result;
  } finally {
    recordExternal(telemetry, operation, {
      ...outcome,
      child,
      duration: performance.now() - timer,
      parentSpanId: span.context.spanId,
      start,
    });
  }
}

function recordDb(
  telemetry: Telemetry,
  operation: DbOperation,
  observation: ChildObservation,
): void {
  const { child, duration, failed, parentSpanId, start } = observation;
  const end = start + duration;
  const values = { "db.operation.name": operation, "db.system.name": "sqlite" };
  const name = `db.${operation}`;
  const kind = spanKind.client;
  const timing = { ...observation, context: child };
  enqueueServer(telemetry, [
    {
      record: spanRecord({ context: child, end, failed, kind, name, parentSpanId, start, values }),
      signal: "traces",
    },
    { record: durationMetric("db.client.operation.duration", values, timing), signal: "metrics" },
  ]);
}

async function withDbSpan<Result>(
  telemetry: Telemetry,
  operation: DbOperation,
  span: ChildSpan<() => Promise<Result>>,
): Promise<Result> {
  const { spanId, start, timer } = startChild();
  const child = { ...span.context, spanId };
  const outcome = { failed: false };
  try {
    return await span.action();
  } catch (error) {
    outcome.failed = true;
    throw error;
  } finally {
    recordDb(telemetry, operation, {
      child,
      duration: performance.now() - timer,
      failed: outcome.failed,
      parentSpanId: span.context.spanId,
      start,
    });
  }
}

export { withDbSpan, withExternalSpan };
export type { DbOperation, ExternalOperation };
