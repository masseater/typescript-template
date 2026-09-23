import { NodeServices } from "@effect/platform-node";
import { Crypto, Effect, FileSystem, Path, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { downloadUrl, type Release, releases, version } from "./releases.ts";

const ownerOnlyDirectory = 0o700;
const ownerOnlyFile = 0o600;
const executableMode = 0o755;

const hexOf = (digestBytes: Uint8Array): string =>
  Array.from(digestBytes, (octet) => octet.toString(16).padStart(2, "0")).join("");

const exists = (file: string): Effect.Effect<boolean> =>
  Effect.gen(function* fileExists() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.exists(file).pipe(Effect.orElseSucceed(() => false));
  }).pipe(Effect.provide(NodeServices.layer));

class BinaryUnavailable extends Schema.TaggedError<BinaryUnavailable>()("BinaryUnavailable", {
  reason: Schema.Literals([
    "archive_corrupted",
    "download_failed",
    "extraction_failed",
    "file_io_failed",
    "platform_unsupported",
  ]),
}) {}

const selectRelease = (): Effect.Effect<Release, BinaryUnavailable> => {
  const found = releases.get(`${process.platform}-${process.arch}`);
  return found === undefined
    ? Effect.fail(new BinaryUnavailable({ reason: "platform_unsupported" }))
    : Effect.succeed(found);
};

const fetchArchive = Effect.fn("fetchArchive")(function* fetchArchive(release: Release) {
  const downloaded = yield* HttpClient.get(downloadUrl(release.archive)).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.mapError(() => new BinaryUnavailable({ reason: "download_failed" })),
  );
  if (downloaded.status < 200 || downloaded.status >= 300) {
    return yield* new BinaryUnavailable({ reason: "download_failed" });
  }
  const archived = new Uint8Array(
    yield* downloaded.arrayBuffer.pipe(
      Effect.mapError(() => new BinaryUnavailable({ reason: "download_failed" })),
    ),
  );
  const crypto = yield* Crypto.Crypto;
  const digest = hexOf(
    yield* crypto
      .digest("SHA-256", archived)
      .pipe(Effect.mapError(() => new BinaryUnavailable({ reason: "archive_corrupted" }))),
  );
  return digest === release.digest
    ? archived
    : yield* new BinaryUnavailable({ reason: "archive_corrupted" });
});

const writeArchive = (placed: {
  readonly archived: Uint8Array;
  readonly directory: string;
  readonly release: Release;
}): Effect.Effect<string, BinaryUnavailable, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* writeReleaseArchive() {
    const paths = yield* Path.Path;
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem
      .remove(placed.directory, { force: true, recursive: true })
      .pipe(Effect.mapError(() => new BinaryUnavailable({ reason: "file_io_failed" })));
    yield* filesystem
      .makeDirectory(placed.directory, { mode: ownerOnlyDirectory, recursive: true })
      .pipe(Effect.mapError(() => new BinaryUnavailable({ reason: "file_io_failed" })));
    const archive = paths.join(placed.directory, placed.release.archive);
    yield* filesystem
      .writeFile(archive, placed.archived, { mode: ownerOnlyFile })
      .pipe(Effect.mapError(() => new BinaryUnavailable({ reason: "file_io_failed" })));
    return archive;
  });

const unpackArchive = (placed: {
  readonly archive: string;
  readonly directory: string;
  readonly member: string;
}): Effect.Effect<
  void,
  BinaryUnavailable,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* unpackReleaseArchive() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const extracted = yield* spawner
      .exitCode(ChildProcess.make("tar", ["-xf", placed.archive], { cwd: placed.directory }))
      .pipe(Effect.mapError(() => new BinaryUnavailable({ reason: "extraction_failed" })));
    if (extracted !== 0) {
      return yield* new BinaryUnavailable({ reason: "extraction_failed" });
    }
    yield* filesystem
      .remove(placed.archive, { force: true })
      .pipe(Effect.mapError(() => new BinaryUnavailable({ reason: "file_io_failed" })));
    yield* filesystem
      .chmod(paths.join(placed.directory, placed.member), executableMode)
      .pipe(Effect.mapError(() => new BinaryUnavailable({ reason: "file_io_failed" })));
  });

const extract = Effect.fn("extract")(function* extract(directory: string, release: Release) {
  const archived = yield* fetchArchive(release);
  const archive = yield* writeArchive({ archived, directory, release });
  yield* unpackArchive({ archive, directory, member: release.member });
});

const installBinary = (home: string): Effect.Effect<string, BinaryUnavailable> =>
  Effect.gen(function* installMeasuredBinary() {
    const paths = yield* Path.Path;
    const directory = paths.join(home, version);
    const release = yield* selectRelease();
    const binary = paths.join(directory, release.member);
    if (!(yield* exists(binary))) {
      yield* extract(directory, release);
    }
    return binary;
  }).pipe(Effect.provide(NodeServices.layer));

export { BinaryUnavailable, exists, installBinary };
