import { Effect } from "effect";

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

const stripInto = (
  arrivals: AsyncIterator<Buffer>,
  stripping: { readonly state: StripState; readonly destination: PassThroughStream },
): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* stripArrival() {
      const arrived = yield* Effect.promise(() => arrivals.next());
      if (arrived.done === true) {
        return;
      }
      if (stripping.state === ground && !arrived.value.includes(ESC)) {
        yield* Effect.promise(() => writeChunk(stripping.destination, arrived.value));
        return yield* Effect.promise(() => stripInto(arrivals, stripping));
      }
      const consumed = consumeBytes(stripping.state, arrived.value);
      if (consumed.emitted !== "") {
        yield* Effect.promise(() =>
          writeChunk(stripping.destination, Buffer.from(consumed.emitted, "latin1")),
        );
      }
      return yield* Effect.promise(() =>
        stripInto(arrivals, { state: consumed.state, destination: stripping.destination }),
      );
    }),
  );

const stripUntilExhausted = (
  source: AsyncIterable<Buffer>,
  destination: PassThroughStream,
): Promise<void> =>
  Effect.runPromise(
    Effect.promise(() =>
      stripInto(source[Symbol.asyncIterator](), { state: ground, destination }),
    ).pipe(
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
