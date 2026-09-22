import { Effect, Predicate, Ref, Schema } from "effect";

import type { LogSink } from "./structured-logs.ts";

const decodeJson = (line: string): unknown =>
  Effect.runSync(
    Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(line).pipe(Effect.orDie),
  );

const parsedLine = (line: string): Readonly<Record<string, unknown>> => {
  const decoded: unknown = decodeJson(line);
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

const recordingSink = (): RecordedLines & { readonly sink: LogSink } => {
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

export { recordingSink };
