import { NodeServices } from "@effect/platform-node";
import { optionalSetting } from "@repo/ai-native-telemetry/optional-setting";
import { Crypto, DateTime, Effect, Path } from "effect";

const withHostPath = <Value>(pick: (hostPath: Path.Path) => Value): Value =>
  Effect.runSync(Effect.provide(Effect.map(Path.Path, pick), NodeServices.layer));

const crypto = Effect.runSync(Effect.provide(Crypto.Crypto, NodeServices.layer));

const nodeFs = process.getBuiltinModule("fs") as {
  readonly existsSync: (location: string) => boolean;
  readonly mkdirSync: (location: string, options: { recursive: boolean }) => void;
  readonly readFileSync: (location: string, encoding: string) => string;
  readonly readdirSync: (location: string) => string[];
  readonly rmSync: (location: string, options: { force: boolean; recursive: boolean }) => void;
  readonly appendFileSync: (location: string, written: string) => void;
  readonly writeFileSync: (location: string, written: string) => void;
};

const joinPath = (...parts: readonly string[]): string =>
  withHostPath((hostPath) => hostPath.join(...parts));

const parentPath = (location: string): string =>
  withHostPath((hostPath) => hostPath.dirname(location));

const baseName = (location: string): string =>
  withHostPath((hostPath) => hostPath.basename(location));

const resolvePath = (...parts: readonly string[]): string =>
  withHostPath((hostPath) => hostPath.resolve(...parts));

const fileExists = (location: string): boolean => nodeFs.existsSync(location);

const makeDirectory = (location: string): void => {
  nodeFs.mkdirSync(location, { recursive: true });
};

const writeFileString = (fileWrite: {
  location: string;
  written: string;
  append?: boolean;
}): void => {
  if (fileWrite.append === true) {
    nodeFs.appendFileSync(fileWrite.location, fileWrite.written);
    return;
  }
  nodeFs.writeFileSync(fileWrite.location, fileWrite.written);
};

const readFileString = (location: string, _encoding?: string): string =>
  nodeFs.readFileSync(location, "utf8");

const readDirectory = (location: string): readonly string[] => nodeFs.readdirSync(location);

const removePath = (location: string): void => {
  nodeFs.rmSync(location, { force: true, recursive: true });
};

const randomHex = (byteCount: number): string =>
  Buffer.from(Effect.runSync(crypto.randomBytes(byteCount).pipe(Effect.orDie))).toString("hex");

const epochMillis = (): number => DateTime.toEpochMillis(DateTime.nowUnsafe());

const wallClockDate = (): Date => DateTime.toDate(DateTime.makeUnsafe(epochMillis()));

export {
  baseName,
  epochMillis,
  fileExists,
  joinPath,
  makeDirectory,
  optionalSetting,
  parentPath,
  randomHex,
  readDirectory,
  readFileString,
  removePath,
  resolvePath,
  wallClockDate,
  writeFileString,
};
