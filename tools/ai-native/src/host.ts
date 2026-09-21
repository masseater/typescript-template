import { NodeServices } from "@effect/platform-node";
import { optionalSetting } from "@repo/ai-native-telemetry/optional-setting";
import { Crypto, DateTime, Effect, FileSystem, Path } from "effect";

const filesystem = Effect.runSync(Effect.provide(FileSystem.FileSystem, NodeServices.layer));

const withHostPath = <Value>(pick: (hostPath: Path.Path) => Value): Value =>
  Effect.runSync(Effect.provide(Effect.map(Path.Path, pick), NodeServices.layer));

const crypto = Effect.runSync(Effect.provide(Crypto.Crypto, NodeServices.layer));

const joinPath = (...parts: readonly string[]): string =>
  withHostPath((hostPath) => hostPath.join(...parts));

const parentPath = (location: string): string =>
  withHostPath((hostPath) => hostPath.dirname(location));

const baseName = (location: string): string =>
  withHostPath((hostPath) => hostPath.basename(location));

const resolvePath = (...parts: readonly string[]): string =>
  withHostPath((hostPath) => hostPath.resolve(...parts));

const runFilesystem = <Value, Failure>(work: Effect.Effect<Value, Failure>): Value =>
  Effect.runSync(Effect.orDie(work));

const fileExists = (location: string): boolean => runFilesystem(filesystem.exists(location));

const makeDirectory = (location: string): void => {
  runFilesystem(filesystem.makeDirectory(location, { recursive: true }));
};

const makeTempDirectory = (prefix: string): string =>
  runFilesystem(filesystem.makeTempDirectory({ prefix }));

const writeFileString = (fileWrite: {
  location: string;
  written: string;
  append?: boolean;
}): void => {
  runFilesystem(
    filesystem.writeFileString(
      fileWrite.location,
      fileWrite.written,
      fileWrite.append === true ? { flag: "a" } : undefined,
    ),
  );
};

const readFileString = (location: string, _encoding?: string): string =>
  runFilesystem(filesystem.readFileString(location));

const readDirectory = (location: string): readonly string[] =>
  runFilesystem(filesystem.readDirectory(location));

const removePath = (location: string): void => {
  runFilesystem(filesystem.remove(location, { force: true, recursive: true }));
};

const realPath = (location: string): string => runFilesystem(filesystem.realPath(location));

const randomHex = (byteCount: number): string =>
  Buffer.from(Effect.runSync(crypto.randomBytes(byteCount).pipe(Effect.orDie))).toString("hex");

const epochMillis = (): number => DateTime.toEpochMillis(DateTime.nowUnsafe());

const dateFrom = (instant: string | number | Date): Date =>
  DateTime.toDate(DateTime.makeUnsafe(instant));

const wallClockDate = (): Date => dateFrom(epochMillis());

const delay = (ms: number): Promise<void> => Effect.runPromise(Effect.sleep(`${ms} millis`));

const nodeFs = process.getBuiltinModule("fs") as {
  readonly chmodSync: (location: string, mode: number) => void;
  readonly rmdirSync: (location: string) => void;
  readonly statSync: (location: string) => { readonly size: number; isFile: () => boolean };
};

const fileInfo = (location: string): { readonly size: number; readonly isFile: () => boolean } => {
  const recorded = nodeFs.statSync(location);
  return { size: recorded.size, isFile: () => recorded.isFile() };
};

const changeMode = (location: string, permissionBits: number): void => {
  nodeFs.chmodSync(location, permissionBits);
};

const removeDirectory = (location: string): void => {
  nodeFs.rmdirSync(location);
};

export {
  baseName,
  changeMode,
  dateFrom,
  delay,
  epochMillis,
  fileExists,
  fileInfo,
  joinPath,
  makeDirectory,
  makeTempDirectory,
  optionalSetting,
  parentPath,
  randomHex,
  readDirectory,
  readFileString,
  realPath,
  removeDirectory,
  removePath,
  resolvePath,
  wallClockDate,
  writeFileString,
};
