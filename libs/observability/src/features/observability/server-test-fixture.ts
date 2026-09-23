import { Effect, Option, Tracer } from "effect";

import { recordingSink } from "./recording-sink-test-fixture.ts";

import type { RecordedLines } from "./recording-sink-test-fixture.ts";
import type { LogSink } from "./structured-logs.ts";

export const recordedLogs = (
  logging: (sink: LogSink) => Effect.Effect<unknown, unknown>,
): Promise<RecordedLines> =>
  Effect.runPromise(
    Effect.gen(function* recordedLogsProgram() {
      const logs = recordingSink();
      yield* Effect.orDie(logging(logs.sink));
      return { stderr: logs.stderr, stdout: logs.stdout, stdwarn: logs.stdwarn };
    }),
  );

const fixedSpanId = "c".repeat(16);
const fixedTraceId = "c".repeat(32);

class FixedSpan extends Tracer.NativeSpan {
  public override get spanId(): string {
    return fixedSpanId;
  }

  public override get traceId(): string {
    return Option.getOrUndefined(this.parent)?.traceId ?? fixedTraceId;
  }
}

export const fixedSpans: Tracer.Tracer = Tracer.make({
  span: (spanOptions) => new FixedSpan(spanOptions),
});
