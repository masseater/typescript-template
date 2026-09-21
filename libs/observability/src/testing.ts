import { Effect, Option, Predicate, Ref, Tracer } from "effect";

import { makeEventQueue, type EventQueue } from "./browser-queue.ts";

import type { BrowserEvent } from "./events.ts";
import type { LogSink } from "./structured-logs.ts";

const parsedLine = (line: string): Readonly<Record<string, unknown>> => {
  const decoded: unknown = JSON.parse(line);
  if (!Predicate.isObject(decoded)) {
    return { "log.unparsed": line };
  }
  return decoded;
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
  logging: (sink: LogSink) => Effect.Effect<unknown, unknown>,
): Promise<RecordedLines> => {
  const logs = recordingSink();
  await Effect.runPromise(Effect.orDie(logging(logs.sink)));
  return { stderr: logs.stderr, stdout: logs.stdout, stdwarn: logs.stdwarn };
};

export const recordedDeliveries = async (delivery: {
  readonly refuse?: boolean;
  readonly exercise: (driver: {
    readonly queue: EventQueue;
    readonly flush: () => Promise<void>;
  }) => Promise<void>;
}): Promise<readonly (readonly BrowserEvent[])[]> => {
  const batches = Ref.makeUnsafe<readonly (readonly BrowserEvent[])[]>([]);
  const queue = makeEventQueue(async (batch) => {
    Effect.runSync(Ref.update(batches, (earlier) => [...earlier, batch]));
    return delivery.refuse === true
      ? Promise.reject(new Error("delivery refused"))
      : Promise.resolve();
  });
  await delivery.exercise({
    flush: async () =>
      Effect.runPromise(Effect.ignore(Effect.tryPromise(async () => queue.flush()))),
    queue,
  });
  return Ref.getUnsafe(batches);
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
