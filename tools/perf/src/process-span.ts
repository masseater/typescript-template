// oxlint-disable-next-line import/no-nodejs-modules
import { access, readFile, writeFile } from "node:fs/promises";
import {
  contextFileName,
  newSpanId,
  parseTraceparent,
  processRecordFileName,
  traceparent,
} from "./protocol.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { renameSync, writeFileSync } from "node:fs";
import type { ProcessRecord } from "./protocol.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

type OpenProcessSpan = Pick<
  ProcessRecord,
  "parentSource" | "parentSpanId" | "pid" | "ppid" | "spanId" | "traceId"
> & { readonly directory: string; readonly traceparent: string };

type ProcessMeasurement = Omit<
  ProcessRecord,
  "parentSource" | "parentSpanId" | "pid" | "ppid" | "spanId" | "traceId"
>;

function reportDropped(event: string, directory: string): void {
  // oxlint-disable-next-line eslint/no-restricted-properties
  process.stderr.write(`${JSON.stringify({ directory, event, ok: false, pid: process.pid })}\n`);
}

async function exists(directory: string): Promise<boolean> {
  return access(directory).then(
    () => true,
    () => false,
  );
}

async function parentContext(
  directory: string,
  ppid: number,
  inherited: string | undefined,
): Promise<Pick<ProcessRecord, "parentSource"> & { readonly value: string | undefined }> {
  return readFile(path.join(directory, contextFileName(ppid)), "utf-8").then(
    (value) => ({ parentSource: "process", value }),
    () => ({ parentSource: "environment", value: inherited }),
  );
}

async function beginProcessSpan(identity: {
  readonly directory: string;
  readonly inherited: string | undefined;
  readonly pid: number;
  readonly ppid: number;
}): Promise<OpenProcessSpan | undefined> {
  const { directory, inherited, pid, ppid } = identity;
  const found = (await exists(directory))
    ? await parentContext(directory, ppid, inherited)
    : undefined;
  const parent = parseTraceparent(found?.value);
  if (found === undefined || parent === undefined) {
    return undefined;
  }
  const spanId = newSpanId();
  const own = traceparent(parent.traceId, spanId);
  return writeFile(path.join(directory, contextFileName(pid)), own).then(
    (): OpenProcessSpan => ({
      directory,
      parentSource: found.parentSource,
      parentSpanId: parent.spanId,
      pid,
      ppid,
      spanId,
      traceId: parent.traceId,
      traceparent: own,
    }),
    (): undefined => {
      reportDropped("perf.process_context_unwritable", directory);
    },
  );
}

function endProcessSpan(span: OpenProcessSpan, measurement: ProcessMeasurement): void {
  const record: ProcessRecord = {
    ...measurement,
    parentSource: span.parentSource,
    parentSpanId: span.parentSpanId,
    pid: span.pid,
    ppid: span.ppid,
    spanId: span.spanId,
    traceId: span.traceId,
  };
  const file = path.join(span.directory, processRecordFileName(span.spanId));
  const partial = `${file}.partial`;
  try {
    // oxlint-disable-next-line node/no-sync
    writeFileSync(partial, JSON.stringify(record));
    // oxlint-disable-next-line node/no-sync
    renameSync(partial, file);
  } catch {
    reportDropped("perf.process_record_dropped", span.directory);
  }
}

export { beginProcessSpan, endProcessSpan };
