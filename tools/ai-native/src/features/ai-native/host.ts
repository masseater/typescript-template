import * as NodeServices from "@effect/platform-node/NodeServices";
import { optionalSetting } from "@repo/ai-native-telemetry/optional-setting";
import { Crypto, DateTime, Effect, FileSystem, Path, type PlatformError } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";

import { homeDirectory, signalNumber, temporaryDirectory } from "./host-facts.ts";

const [paths, filesystem, randomness, spawner] = Effect.runSync(
  Effect.all([
    Path.Path,
    FileSystem.FileSystem,
    Crypto.Crypto,
    ChildProcessSpawner.ChildProcessSpawner,
  ]).pipe(Effect.provide(NodeServices.layer)),
);

const joinPath = (...parts: readonly string[]): string => paths.join(...parts);

const parentPath = (location: string): string => paths.dirname(location);

const baseName = (location: string): string => paths.basename(location);

const resolvePath = (...parts: readonly string[]): string => paths.resolve(...parts);

const fileExists = (location: string): Effect.Effect<boolean> =>
  filesystem.exists(location).pipe(Effect.orElseSucceed(() => false));

const nativeFailure = (failure: PlatformError.PlatformError): Error =>
  failure.reason.cause instanceof Error ? failure.reason.cause : failure;

const onDisk = <A, R>(
  operation: Effect.Effect<A, PlatformError.PlatformError, R>,
): Effect.Effect<A, Error, R> => Effect.mapError(operation, nativeFailure);

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
  baseName,
  epochMillis,
  fileExists,
  filesystem,
  homeDirectory,
  joinPath,
  makeDirectory,
  nativeFailure,
  onDisk,
  optionalSetting,
  parentPath,
  randomHex,
  readDirectory,
  readFileString,
  removePath,
  resolvePath,
  signalNumber,
  spawner,
  temporaryDirectory,
  wallClockDate,
  writeFileString,
};
