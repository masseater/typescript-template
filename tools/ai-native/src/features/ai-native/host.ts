import * as NodeServices from "@effect/platform-node/NodeServices";
import { Crypto, DateTime, Effect, FileSystem, Path, type PlatformError } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";

const [paths, filesystem, randomness, spawner] = Effect.runSync(
  Effect.all([
    Path.Path,
    FileSystem.FileSystem,
    Crypto.Crypto,
    ChildProcessSpawner.ChildProcessSpawner,
  ]).pipe(Effect.provide(NodeServices.layer)),
);

const nativeFailure = (failure: PlatformError.PlatformError): Error =>
  failure.reason.cause instanceof Error ? failure.reason.cause : failure;

const onDisk = <A, R>(
  operation: Effect.Effect<A, PlatformError.PlatformError, R>,
): Effect.Effect<A, Error, R> => Effect.mapError(operation, nativeFailure);

const fileExists = (location: string): Effect.Effect<boolean, Error> =>
  onDisk(filesystem.exists(location));

const makeDirectory = (location: string): Effect.Effect<void, Error> =>
  onDisk(filesystem.makeDirectory(location, { recursive: true }));

const writeFileString = (fileWrite: {
  location: string;
  written: string;
  append?: boolean;
}): Effect.Effect<void, Error> =>
  onDisk(
    filesystem.writeFileString(
      fileWrite.location,
      fileWrite.written,
      fileWrite.append === true ? { flag: "a" } : undefined,
    ),
  );

const readFileString = (location: string): Effect.Effect<string, Error> =>
  onDisk(filesystem.readFileString(location));

const readDirectory = (location: string): Effect.Effect<readonly string[], Error> =>
  onDisk(filesystem.readDirectory(location));

const removePath = (location: string): Effect.Effect<void, Error> =>
  onDisk(filesystem.remove(location, { force: true, recursive: true }));

const randomHex = (byteCount: number): string =>
  Buffer.from(Effect.runSync(randomness.randomBytes(byteCount))).toString("hex");

const epochMillis = (): number => DateTime.toEpochMillis(DateTime.nowUnsafe());

const wallClockDate = (): Date => DateTime.toDate(DateTime.makeUnsafe(epochMillis()));

export {
  epochMillis,
  fileExists,
  filesystem,
  makeDirectory,
  nativeFailure,
  onDisk,
  paths,
  randomHex,
  readDirectory,
  readFileString,
  removePath,
  spawner,
  wallClockDate,
  writeFileString,
};
