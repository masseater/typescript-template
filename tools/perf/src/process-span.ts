import type { ProcessRecord, SpanContext } from "./protocol.ts";
import {
  contextFileName,
  parseTraceparent,
  processRecordFileName,
  spanIdBytes,
} from "./protocol.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { randomBytes } from "node:crypto";
// oxlint-disable-next-line import/no-nodejs-modules
import { writeFileSync } from "node:fs";

interface ProcessIdentity {
  readonly directory: string;
  readonly inherited: string | undefined;
  readonly pid: number;
  readonly ppid: number;
}

interface OpenProcessSpan {
  readonly directory: string;
  readonly parent: SpanContext;
  readonly pid: number;
  readonly ppid: number;
  readonly spanId: string;
  readonly traceparent: string;
}

type ProcessMeasurement = Omit<
  ProcessRecord,
  "parentSpanId" | "pid" | "ppid" | "spanId" | "traceId"
>;

async function beginProcessSpan(identity: ProcessIdentity): Promise<OpenProcessSpan | undefined> {
  const recorded = await readFile(
    path.join(identity.directory, contextFileName(identity.ppid)),
    "utf-8",
  ).catch(() => identity.inherited);
  const parent = parseTraceparent(recorded);
  if (parent === undefined) {
    return undefined;
  }
  const spanId = randomBytes(spanIdBytes).toString("hex");
  const traceparent = `00-${parent.traceId}-${spanId}-01`;
  await writeFile(path.join(identity.directory, contextFileName(identity.pid)), traceparent);
  return { ...identity, parent, spanId, traceparent };
}

function endProcessSpan(span: OpenProcessSpan, measurement: ProcessMeasurement): void {
  const record: ProcessRecord = {
    ...measurement,
    parentSpanId: span.parent.spanId,
    pid: span.pid,
    ppid: span.ppid,
    spanId: span.spanId,
    traceId: span.parent.traceId,
  };
  // oxlint-disable-next-line node/no-sync
  writeFileSync(
    path.join(span.directory, processRecordFileName(span.spanId)),
    JSON.stringify(record),
  );
}

export { beginProcessSpan, endProcessSpan };
