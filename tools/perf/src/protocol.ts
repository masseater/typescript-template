interface ProcessRecord {
  readonly argv: readonly string[];
  readonly cpuSystemMilliseconds: number;
  readonly cpuUserMilliseconds: number;
  readonly cwd: string;
  readonly endMilliseconds: number;
  readonly exitCode: number;
  readonly maxRssKilobytes: number;
  readonly parentSpanId: string;
  readonly pid: number;
  readonly ppid: number;
  readonly spanId: string;
  readonly startMilliseconds: number;
  readonly traceId: string;
}

interface SpanContext {
  readonly spanId: string;
  readonly traceId: string;
}

const traceIdBytes = 16;
const spanIdBytes = 8;
const traceparentPattern = /^00-(?<traceId>[\da-f]{32})-(?<spanId>[\da-f]{16})-[\da-f]{2}$/u;
const processRecordSuffix = ".process.json";

function parseTraceparent(value: string | undefined): SpanContext | undefined {
  const groups = traceparentPattern.exec(value?.trim() ?? "")?.groups;
  const traceId = groups?.["traceId"];
  const spanId = groups?.["spanId"];
  return traceId === undefined || spanId === undefined ? undefined : { spanId, traceId };
}

function contextFileName(pid: number): string {
  return `${pid}.traceparent`;
}

function processRecordFileName(spanId: string): string {
  return `${spanId}${processRecordSuffix}`;
}

export {
  contextFileName,
  parseTraceparent,
  processRecordFileName,
  processRecordSuffix,
  spanIdBytes,
  traceIdBytes,
};
export type { ProcessRecord, SpanContext };
