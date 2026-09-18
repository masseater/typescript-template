// oxlint-disable-next-line import/no-nodejs-modules
import { constants } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import { copyFile, lstat, mkdir } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Effect } from "effect";

import { assertRealDirectory, fail, files, io, sameContent } from "./artifact-io.ts";

const assertExistingStagedCopy = Effect.fn("assertExistingStagedCopy")(
  function* assertExistingStagedCopy(source: string, destination: string) {
    const existing = yield* io(async () => lstat(destination));
    if (!existing.isFile() || existing.nlink !== 1) {
      return yield* fail("artifact_staging_link_forbidden");
    }
    if (!(yield* sameContent(source, destination))) {
      return yield* fail("artifact_staging_contaminated");
    }
    return destination;
  },
);

function isExistingFile(cause: unknown): boolean {
  return cause instanceof Error && "code" in cause && cause.code === "EEXIST";
}

const stageFile = Effect.fn("stageFile")(function* stageFile(source: string, destination: string) {
  yield* io(async () => mkdir(path.dirname(destination), { recursive: true }));
  yield* assertRealDirectory(path.dirname(destination), "artifact_staging_symlink_forbidden");
  yield* Effect.tryPromise({
    catch: (cause) => ({ cause }),
    try: async () => copyFile(source, destination, constants.COPYFILE_EXCL),
  }).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catch(({ cause }) =>
      isExistingFile(cause)
        ? assertExistingStagedCopy(source, destination)
        : fail("artifact_io_failed"),
    ),
  );
});

const stageFiles = Effect.fn("stageFiles")(function* stageFiles(
  source: string,
  staging: string,
  sourceFiles: readonly string[],
) {
  yield* io(async () => mkdir(staging, { recursive: true }));
  yield* assertRealDirectory(staging, "artifact_staging_symlink_forbidden");
  yield* Effect.all(
    sourceFiles.map((file) => stageFile(file, path.join(staging, path.relative(source, file)))),
    { concurrency: "unbounded", discard: true },
  );
  const stagedFiles = yield* files(staging);
  const unexpected = stagedFiles.some(
    (file) => !sourceFiles.includes(path.join(source, path.relative(staging, file))),
  );
  if (stagedFiles.length !== sourceFiles.length || unexpected) {
    return yield* fail("artifact_staging_contaminated");
  }
});

export { stageFiles };
