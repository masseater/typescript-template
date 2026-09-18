import { Effect, Option, Ref, Tracer } from "effect";

import { isRecord, type LogSink } from "./structured-logs.ts";

const parsedLine = (line: string): Readonly<Record<string, unknown>> => {
  const decoded: unknown = JSON.parse(line);
  return isRecord(decoded) ? decoded : {};
};

type RecordedLines = {
  readonly stderr: readonly Readonly<Record<string, unknown>>[];
  readonly stdout: readonly Readonly<Record<string, unknown>>[];
  readonly stdwarn: readonly Readonly<Record<string, unknown>>[];
};

export const recordingSink = (): RecordedLines & { readonly sink: LogSink } => {
  const lines = Ref.makeUnsafe<RecordedLines>({ stderr: [], stdout: [], stdwarn: [] });
  const recordInto =
    (stream: keyof RecordedLines) =>
    (line: string): void => {
      Effect.runSync(
        Ref.update(lines, (earlier) => ({
          ...earlier,
          [stream]: [...earlier[stream], parsedLine(line)],
        })),
      );
    };
  return {
    sink: { error: recordInto("stderr"), info: recordInto("stdout"), warn: recordInto("stdwarn") },
    get stderr(): RecordedLines["stderr"] {
      return Ref.getUnsafe(lines).stderr;
    },
    get stdout(): RecordedLines["stdout"] {
      return Ref.getUnsafe(lines).stdout;
    },
    get stdwarn(): RecordedLines["stdwarn"] {
      return Ref.getUnsafe(lines).stdwarn;
    },
  };
};

export const recordedLogs = async (
  logging: (sink: LogSink) => Effect.Effect<void>,
): Promise<RecordedLines> => {
  const logs = recordingSink();
  await Effect.runPromise(logging(logs.sink));
  return { stderr: logs.stderr, stdout: logs.stdout, stdwarn: logs.stdwarn };
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
