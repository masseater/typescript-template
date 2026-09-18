import { Option, Tracer } from "effect";

import type { LogSink } from "./structured-logs.ts";

export const recordingSink = (): {
  readonly sink: LogSink;
  readonly stderr: readonly unknown[];
  readonly stdout: readonly unknown[];
  readonly stdwarn: readonly unknown[];
} => {
  const stderr: unknown[] = [];
  const stdout: unknown[] = [];
  const stdwarn: unknown[] = [];
  return {
    sink: {
      error: (line) => {
        stderr.push(JSON.parse(line));
      },
      info: (line) => {
        stdout.push(JSON.parse(line));
      },
      warn: (line) => {
        stdwarn.push(JSON.parse(line));
      },
    },
    stderr,
    stdout,
    stdwarn,
  };
};

const fixedSpanId = "c".repeat(16);
const fixedTraceId = "c".repeat(32);

class FixedSpan extends Tracer.NativeSpan {
  public override readonly spanId: string = fixedSpanId;
  public override readonly traceId: string =
    Option.getOrUndefined(this.parent)?.traceId ?? fixedTraceId;
}

export const fixedSpans: Tracer.Tracer = Tracer.make({
  span: (spanOptions) => new FixedSpan(spanOptions),
});
