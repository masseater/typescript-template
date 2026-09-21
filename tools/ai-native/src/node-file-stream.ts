type PassThroughStream = {
  end: () => void;
  on: (event: string, listener: (part: Buffer) => void) => unknown;
  once: (event: string, listener: () => void) => unknown;
  pipe: (destination: unknown, options?: { end?: boolean }) => PassThroughStream;
  write: (part: string | Uint8Array) => boolean;
  [Symbol.asyncIterator]: () => AsyncIterator<Uint8Array>;
};

type FileWriteStream = {
  destroy: () => void;
  end: (done?: () => void) => void;
  on: (event: string, listener: (failure: Error) => void) => unknown;
  once: (event: string, listener: () => void) => unknown;
  write: (part: string | Uint8Array) => boolean;
};

type ReadableFile = {
  destroy: () => void;
  pipe: (destination: unknown, options?: { end?: boolean }) => unknown;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
};

const fileStreamApi = process.getBuiltinModule("fs") as {
  readonly createReadStream: (location: string) => ReadableFile;
  readonly createWriteStream: (location: string, openFlags: { flags: "w" }) => FileWriteStream;
};

const streamApi = process.getBuiltinModule("stream") as {
  readonly PassThrough: new () => PassThroughStream;
};

const streamConsumers = process.getBuiltinModule("stream/consumers") as {
  readonly text: (readable: unknown) => Promise<string>;
};

const openWriteStream = (location: string): FileWriteStream =>
  fileStreamApi.createWriteStream(location, { flags: "w" });

const openReadStream = (location: string): ReadableFile => fileStreamApi.createReadStream(location);

const consumeText = (readable: unknown): Promise<string> => streamConsumers.text(readable);

const PassThrough = streamApi.PassThrough;

export { consumeText, openReadStream, openWriteStream, PassThrough };
export type { FileWriteStream, PassThroughStream, ReadableFile };
