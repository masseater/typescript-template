import { Data, Effect, Stream } from "effect";

import { waitEmitterEvent } from "../emitter-wait.ts";

const duplexStreamApi = process.getBuiltinModule("stream") as {
  readonly Duplex: {
    from: (factory: (source: AsyncIterable<Buffer>) => AsyncIterable<Buffer>) => DuplexStream;
  };
  readonly PassThrough: new () => PassThroughStream;
};

type DuplexStream = {
  end: () => void;
  on?: (event: string, listener: (part: Buffer | Error) => void) => unknown;
  once: (event: string, listener: () => void) => unknown;
  pipe: (destination: unknown, options?: { end?: boolean }) => DuplexStream;
  resume?: () => void;
  unpipe?: (destination: unknown) => unknown;
  write: (part: Buffer) => boolean;
};

type PassThroughStream = DuplexStream & AsyncIterable<Buffer>;

const ESC = 0x1b;
const BEL = 0x07;

type StripStep = { state: StripState; emitted: string };
type StripState = { consume: (byte: number) => StripStep };

const ground: StripState = {
  consume: (byte) =>
    byte === ESC
      ? { state: escapeLead, emitted: "" }
      : { state: ground, emitted: String.fromCharCode(byte) },
};

const escapeLead: StripState = {
  consume: (byte) => ({ state: escapeLeadTarget(byte), emitted: "" }),
};

const escapeLeadTarget = (byte: number): StripState => {
  if (byte === 0x5b) {
    return csiBody;
  }
  if (byte === 0x5d || byte === 0x50 || byte === 0x58 || byte === 0x5e || byte === 0x5f) {
    return stringBody;
  }
  if (byte >= 0x20 && byte <= 0x2f) {
    return escapeIntermediate;
  }
  return byte === ESC ? escapeLead : ground;
};

const escapeIntermediate: StripState = {
  consume: (byte) => ({
    state: byte >= 0x20 && byte <= 0x2f ? escapeIntermediate : ground,
    emitted: "",
  }),
};

const csiBody: StripState = {
  consume: (byte) => {
    if (byte >= 0x40 && byte <= 0x7e) {
      return { state: ground, emitted: "" };
    }
    if (byte < 0x20) {
      return { state: ground, emitted: String.fromCharCode(byte) };
    }
    return { state: csiBody, emitted: "" };
  },
};

const stringBody: StripState = {
  consume: (byte) => {
    if (byte === BEL) {
      return { state: ground, emitted: "" };
    }
    return byte === ESC ? { state: stringEscape, emitted: "" } : { state: stringBody, emitted: "" };
  },
};

const stringEscape: StripState = {
  consume: (byte) =>
    byte === 0x5c || byte === BEL ? { state: ground, emitted: "" } : escapeLead.consume(byte),
};

const consumeBytes = (startingState: StripState, bytes: Buffer): StripStep =>
  bytes.reduce<StripStep>(
    (accumulated, byte) => {
      const step = accumulated.state.consume(byte);
      return { state: step.state, emitted: accumulated.emitted + step.emitted };
    },
    { state: startingState, emitted: "" },
  );

const writeChunk = (destination: PassThroughStream, part: Buffer): Promise<void> =>
  destination.write(part) ? Promise.resolve() : waitEmitterEvent(destination, "drain");

const writeStrippedArrival = (input: {
  readonly arrival: Buffer;
  readonly destination: PassThroughStream;
  readonly stripMachine: StripState;
}): Effect.Effect<StripState> =>
  input.stripMachine === ground && !input.arrival.includes(ESC)
    ? Effect.promise(() => writeChunk(input.destination, input.arrival)).pipe(
        Effect.as(input.stripMachine),
      )
    : Effect.gen(function* writeConsumed() {
        const consumed = consumeBytes(input.stripMachine, input.arrival);
        if (consumed.emitted !== "") {
          yield* Effect.promise(() =>
            writeChunk(input.destination, Buffer.from(consumed.emitted, "latin1")),
          );
        }
        return consumed.state;
      });

class StripSourceFailed extends Data.TaggedError("StripSourceFailed")<{
  readonly cause: unknown;
}> {}

const stripUntilExhausted = (
  source: AsyncIterable<Buffer>,
  destination: PassThroughStream,
): Promise<void> =>
  Effect.runPromise(
    Stream.fromAsyncIterable(source, (cause) => new StripSourceFailed({ cause })).pipe(
      Stream.runFoldEffect(
        () => ground,
        (stripMachine, arrival) => writeStrippedArrival({ arrival, destination, stripMachine }),
      ),
      Effect.asVoid,
      Effect.ensuring(
        Effect.sync(() => {
          destination.end();
        }),
      ),
    ),
  );

const pullStripped = (
  inner: AsyncIterator<Buffer>,
  stripping: Promise<void>,
): Promise<IteratorResult<Buffer>> =>
  Effect.runPromise(
    Effect.gen(function* takeStripped() {
      const pulled = yield* Effect.promise(() => inner.next());
      if (pulled.done === true) {
        yield* Effect.promise(() => stripping);
      }
      return pulled;
    }),
  );

export const createEscapeStripper = (): DuplexStream =>
  duplexStreamApi.Duplex.from((source: AsyncIterable<Buffer>) => ({
    [Symbol.asyncIterator]: (): AsyncIterator<Buffer> => {
      const stripped = new duplexStreamApi.PassThrough();
      const stripping = stripUntilExhausted(source, stripped);
      const inner = stripped[Symbol.asyncIterator]();
      return {
        next: (): Promise<IteratorResult<Buffer>> => pullStripped(inner, stripping),
      };
    },
  }));
