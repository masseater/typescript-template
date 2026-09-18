// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { createHash } from "node:crypto";
// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdir, rm, stat, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

import { Effect, Schema } from "effect";

import { downloadUrl, releases, version } from "./releases.ts";

import type { Release } from "./releases.ts";

class BinaryUnavailable extends Schema.TaggedError<BinaryUnavailable>()("BinaryUnavailable", {
  reason: Schema.Literals([
    "archive_corrupted",
    "download_failed",
    "extraction_failed",
    "file_io_failed",
    "platform_unsupported",
  ]),
}) {}

// oxlint-disable-next-line typescript/strict-void-return
const execFileAsync = promisify(execFile);
const ownerOnlyDirectory = 0o700;
const ownerOnlyFile = 0o600;
const executableMode = 0o755;

function fileIo<Value>(operation: () => Promise<Value>): Effect.Effect<Value, BinaryUnavailable> {
  return Effect.tryPromise({
    catch: () => new BinaryUnavailable({ reason: "file_io_failed" }),
    try: operation,
  });
}

function exists(file: string): Effect.Effect<boolean> {
  return fileIo(async () => stat(file)).pipe(
    Effect.match({ onFailure: () => false, onSuccess: () => true }),
  );
}

function selectRelease(): Effect.Effect<Release, BinaryUnavailable> {
  const found = releases.get(`${process.platform}-${process.arch}`);
  return found === undefined
    ? Effect.fail(new BinaryUnavailable({ reason: "platform_unsupported" }))
    : Effect.succeed(found);
}

const fetchArchive = Effect.fn("fetchArchive")(function* fetchArchive(release: Release) {
  const response = yield* Effect.tryPromise({
    catch: () => new BinaryUnavailable({ reason: "download_failed" }),
    try: async () => fetch(downloadUrl(release.archive), { redirect: "follow" }),
  });
  if (!response.ok) {
    return yield* new BinaryUnavailable({ reason: "download_failed" });
  }
  const content = Buffer.from(
    yield* Effect.tryPromise({
      catch: () => new BinaryUnavailable({ reason: "download_failed" }),
      try: async () => response.arrayBuffer(),
    }),
  );
  return createHash("sha256").update(content).digest("hex") === release.digest
    ? content
    : yield* new BinaryUnavailable({ reason: "archive_corrupted" });
});

const extract = Effect.fn("extract")(function* extract(directory: string, release: Release) {
  const content = yield* fetchArchive(release);
  yield* fileIo(async () => rm(directory, { force: true, recursive: true }));
  yield* fileIo(async () => mkdir(directory, { mode: ownerOnlyDirectory, recursive: true }));
  const archive = path.join(directory, release.archive);
  yield* fileIo(async () => writeFile(archive, content, { mode: ownerOnlyFile }));
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
