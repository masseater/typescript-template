import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { Effect, Schema } from "effect";

import type { Dirent } from "node:fs";

type ArtifactEntry = Readonly<Pick<Dirent, "isDirectory" | "isFile" | "isSymbolicLink" | "name">>;

class ArtifactFailure extends Schema.TaggedError<ArtifactFailure>()("ArtifactFailure", {
  code: Schema.Literals([
    "artifact_io_failed",
    "artifact_symlink_forbidden",
    "artifact_file_type_invalid",
    "artifact_directory_symlink_forbidden",
    "private_client_artifact",
    "server_only_code_in_client",
    "client_artifacts_empty",
    "worker_entry_missing_index_js",
    "worker_entry_empty",
    "worker_module_type_unsupported",
    "server_css_without_public_asset",
    "artifact_staging_symlink_forbidden",
    "artifact_staging_link_forbidden",
    "artifact_staging_contaminated",
    "source_map_directory_invalid",
    "source_map_symlink_forbidden",
    "budget_worker_artifact_empty",
    "error_worker_artifact_empty",
    "health_worker_artifact_empty",
  ]),
}) {}

const fail = (code: ArtifactFailure["code"]): Effect.Effect<never, ArtifactFailure> => {
  return Effect.fail(new ArtifactFailure({ code }));
};

const io = <Value>(run: () => Promise<Value>): Effect.Effect<Value, ArtifactFailure> => {
  return Effect.tryPromise({
    catch: () => new ArtifactFailure({ code: "artifact_io_failed" }),
    try: run,
  });
};

const entryFiles = (
  directory: string,
  entry: ArtifactEntry,
): Effect.Effect<string[], ArtifactFailure> => {
  if (entry.isSymbolicLink()) {
    return fail("artifact_symlink_forbidden");
  }
  const filename = path.join(directory, entry.name);
  if (entry.isDirectory()) {
    return files(filename);
  }
  return entry.isFile() ? Effect.succeed([filename]) : fail("artifact_file_type_invalid");
};

const files = (directory: string): Effect.Effect<string[], ArtifactFailure> => {
  return io(async () => readdir(directory, { withFileTypes: true })).pipe(
    Effect.flatMap((entries) =>
      Effect.all(
        entries.map((entry: ArtifactEntry) => entryFiles(directory, entry)),
        { concurrency: "unbounded" },
      ),
    ),

    Effect.map((nested) => nested.flat().toSorted()),
  );
};

const sha256Hex = (content: Uint8Array<ArrayBuffer>): Effect.Effect<string, ArtifactFailure> => {
  return io(async () =>
    Buffer.from(await crypto.subtle.digest("SHA-256", content)).toString("hex"),
  );
};

const fileSha256 = (file: string): Effect.Effect<string, ArtifactFailure> => {
  return io(async () => readFile(file)).pipe(Effect.flatMap(sha256Hex));
};

const jsonSha256 = (value: unknown): Effect.Effect<string, ArtifactFailure> => {
  return sha256Hex(new TextEncoder().encode(JSON.stringify(value)));
};

const sameContent = (left: string, right: string): Effect.Effect<boolean, ArtifactFailure> => {
  return io(async () => Promise.all([readFile(left), readFile(right)])).pipe(
    Effect.map(([leftContent, rightContent]) => leftContent.equals(rightContent)),
  );
};

const assertRealDirectory = (
  directory: string,
  code: ArtifactFailure["code"],
): Effect.Effect<void, ArtifactFailure> => {
  return io(async () => realpath(directory)).pipe(
    Effect.flatMap((resolved) => (resolved === directory ? Effect.void : fail(code))),
  );
};

export {
  ArtifactFailure,
  assertRealDirectory,
  fail,
  fileSha256,
  files,
  io,
  jsonSha256,
  sameContent,
};
