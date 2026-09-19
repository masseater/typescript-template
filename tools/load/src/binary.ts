import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { Effect, Schema } from "effect";

import { downloadUrl, type Release, releases, version } from "./releases.ts";

class BinaryUnavailable extends Schema.TaggedError<BinaryUnavailable>()("BinaryUnavailable", {
  reason: Schema.Literals([
    "archive_corrupted",
    "download_failed",
    "extraction_failed",
    "file_io_failed",
    "platform_unsupported",
  ]),
}) {}

const execFileAsync = promisify(execFile);
const ownerOnlyDirectory = 0o700;
const ownerOnlyFile = 0o600;
const executableMode = 0o755;

const fileIo = <Value>(
  operation: () => Promise<Value>,
): Effect.Effect<Value, BinaryUnavailable> => {
  return Effect.tryPromise({
    catch: () => new BinaryUnavailable({ reason: "file_io_failed" }),
    try: operation,
  });
};

const exists = (file: string): Effect.Effect<boolean> => {
  return fileIo(async () => stat(file)).pipe(
    Effect.match({ onFailure: () => false, onSuccess: () => true }),
  );
};

const selectRelease = (): Effect.Effect<Release, BinaryUnavailable> => {
  const found = releases.get(`${process.platform}-${process.arch}`);
  return found === undefined
    ? Effect.fail(new BinaryUnavailable({ reason: "platform_unsupported" }))
    : Effect.succeed(found);
};

const fetchArchive = Effect.fn("fetchArchive")(function* fetchArchive(release: Release) {
  const downloaded = yield* Effect.tryPromise({
    catch: () => new BinaryUnavailable({ reason: "download_failed" }),
    try: async () => fetch(downloadUrl(release.archive), { redirect: "follow" }),
  });
  if (!downloaded.ok) {
    return yield* new BinaryUnavailable({ reason: "download_failed" });
  }
  const archived = Buffer.from(
    yield* Effect.tryPromise({
      catch: () => new BinaryUnavailable({ reason: "download_failed" }),
      try: async () => downloaded.arrayBuffer(),
    }),
  );
  return createHash("sha256").update(archived).digest("hex") === release.digest
    ? archived
    : yield* new BinaryUnavailable({ reason: "archive_corrupted" });
});

const extract = Effect.fn("extract")(function* extract(directory: string, release: Release) {
  const archived = yield* fetchArchive(release);
  yield* fileIo(async () => rm(directory, { force: true, recursive: true }));
  yield* fileIo(async () => mkdir(directory, { mode: ownerOnlyDirectory, recursive: true }));
  const archive = path.join(directory, release.archive);
  yield* fileIo(async () => writeFile(archive, archived, { mode: ownerOnlyFile }));
  yield* Effect.tryPromise({
    catch: () => new BinaryUnavailable({ reason: "extraction_failed" }),
    try: async () => execFileAsync("tar", ["-xf", archive], { cwd: directory }),
  });
  yield* fileIo(async () => rm(archive, { force: true }));
  yield* fileIo(async () => chmod(path.join(directory, release.member), executableMode));
});

const installBinary = Effect.fn("installBinary")(function* installBinary(home: string) {
  const directory = path.join(home, version);
  const release = yield* selectRelease();
  const binary = path.join(directory, release.member);
  if (!(yield* exists(binary))) {
    yield* extract(directory, release);
  }
  return binary;
});

export { BinaryUnavailable, exists, installBinary };
