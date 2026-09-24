import { Stream } from "effect";

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

const stringIntroducers: ReadonlySet<number> = new Set([0x50, 0x58, 0x5d, 0x5e, 0x5f]);

const isIntermediate = (byte: number): boolean => byte >= 0x20 && byte <= 0x2f;

const escapeLeadTarget = (byte: number): StripState => {
  if (byte === 0x5b) {
    return csiBody;
  }
  if (stringIntroducers.has(byte)) {
    return stringBody;
  }
  if (isIntermediate(byte)) {
    return escapeIntermediate;
  }
  return byte === ESC ? escapeLead : ground;
};

const escapeIntermediate: StripState = {
  consume: (byte) => ({
    state: isIntermediate(byte) ? escapeIntermediate : ground,
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

const consumeBytes = (
  startingState: StripState,
  bytes: Uint8Array,
): readonly [StripState, readonly Uint8Array[]] => {
  const consumed = bytes.reduce<StripStep>(
    (accumulated, byte) => {
      const step = accumulated.state.consume(byte);
      return { state: step.state, emitted: accumulated.emitted + step.emitted };
    },
    { state: startingState, emitted: "" },
  );
  return [consumed.state, consumed.emitted === "" ? [] : [Buffer.from(consumed.emitted, "latin1")]];
};

const stripArrival = (
  stripMachine: StripState,
  arrival: Uint8Array,
): readonly [StripState, readonly Uint8Array[]] =>
  stripMachine === ground && !arrival.includes(ESC)
    ? [stripMachine, arrival.length === 0 ? [] : [arrival]]
    : consumeBytes(stripMachine, arrival);

export const stripEscapes = <E, R>(
  source: Stream.Stream<Uint8Array, E, R>,
): Stream.Stream<Uint8Array, E, R> => Stream.mapAccum(source, () => ground, stripArrival);
