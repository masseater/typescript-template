type FileWriteStream = {
  destroy: () => void;
  end: (done?: () => void) => void;
  on: (event: string, listener: (failure: Error) => void) => unknown;
  once: (event: string, listener: () => void) => unknown;
  write: (part: string | Uint8Array) => boolean;
};

const fileStreamApi = process.getBuiltinModule("fs") as {
  readonly createWriteStream: (location: string, openFlags: { flags: "w" }) => FileWriteStream;
};

const openWriteStream = (location: string): FileWriteStream =>
  fileStreamApi.createWriteStream(location, { flags: "w" });

export { openWriteStream };
export type { FileWriteStream };
