interface SpanContext {
  readonly spanId: string;
  readonly traceId: string;
}

type Attributes = Readonly<
  Record<string, boolean | number | string | readonly string[] | undefined>
>;

interface ProcessRecord {
  readonly argv: readonly string[];
  readonly cpuSystemMilliseconds: number;
  readonly cpuUserMilliseconds: number;
  readonly cwd: string;
  readonly endMilliseconds: number;
  readonly exitCode: number;
  readonly maxRssKilobytes: number;
  readonly parentSource: "environment" | "process";
  readonly parentSpanId: string;
  readonly pid: number;
  readonly ppid: number;
  readonly spanId: string;
  readonly startMilliseconds: number;
  readonly traceId: string;
}

const TRACE_ID_BYTES = 16;
const SPAN_ID_BYTES = 8;
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;
const processRecordSuffix = ".process.json";
const traceparentPattern =
  /^00-(?<traceId>(?!0{32})[\da-f]{32})-(?<spanId>(?!0{16})[\da-f]{16})-[\da-f]{2}$/u;

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0"),
  ).join("");
}

function newTraceId(): string {
  return randomHex(TRACE_ID_BYTES);
}

function newSpanId(): string {
  return randomHex(SPAN_ID_BYTES);
}

function traceparent(traceId: string, spanId: string): string {
  return `00-${traceId}-${spanId}-01`;
}

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
  newSpanId,
  newTraceId,
  parseTraceparent,
  processRecordFileName,
  processRecordSuffix,
  traceparent,
};
export type { Attributes, ProcessRecord };
