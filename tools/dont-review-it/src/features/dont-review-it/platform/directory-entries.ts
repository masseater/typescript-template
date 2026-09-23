import { Effect, FileSystem, type PlatformError, Schema } from "effect";

import { unlessMissing } from "./file-system.ts";
import { isNotALink } from "./path-failure.ts";
import { path } from "./path.ts";

type EntryKind = "directory" | "file" | "symlink" | "dangling-symlink" | "other";

interface DirectoryEntry {
  readonly kind: EntryKind;
  readonly name: string;
}

class DanglingSymlink extends Schema.TaggedError<DanglingSymlink>()("DanglingSymlink", {
  path: Schema.String,
}) {
  override get message(): string {
    return `${this.path} is a symbolic link to nothing, so what it was meant to hold cannot be read.`;
  }
}

export type TreeFailure = PlatformError.PlatformError | DanglingSymlink;

const entryKind = (
  entryPath: string,
): Effect.Effect<EntryKind, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* entryKind() {
    const filesystem = yield* FileSystem.FileSystem;
    const linked = yield* filesystem.readLink(entryPath).pipe(
      Effect.as(true),
      Effect.catchIf(isNotALink, () => Effect.succeed(false)),
    );
    if (linked) {
      const reached = yield* unlessMissing(filesystem.stat(entryPath));
      return reached === null ? "dangling-symlink" : "symlink";
    }
    const { type } = yield* filesystem.stat(entryPath);
    return type === "Directory" ? "directory" : type === "File" ? "file" : "other";
  });

export const directoryEntries = (
  directory: string,
): Effect.Effect<readonly DirectoryEntry[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* directoryEntries() {
    const filesystem = yield* FileSystem.FileSystem;
    const names = yield* filesystem.readDirectory(directory);
    return yield* Effect.forEach(
      names.toSorted(),
      (name) => Effect.map(entryKind(path.join(directory, name)), (kind) => ({ kind, name })),
      { concurrency: "unbounded" },
    );
  });

const settledEntries = (
  directory: string,
  entries: readonly DirectoryEntry[],
): Effect.Effect<readonly DirectoryEntry[], DanglingSymlink> => {
  const dangling = entries.find((entry) => entry.kind === "dangling-symlink");
  return dangling === undefined
    ? Effect.succeed(entries)
    : Effect.fail(new DanglingSymlink({ path: path.join(directory, dangling.name) }));
};

export const childDirectoryNamesIn = (
  parentPath: string,
): Effect.Effect<readonly string[] | null, TreeFailure, FileSystem.FileSystem> =>
  Effect.gen(function* childDirectoryNamesIn() {
    const listed = yield* unlessMissing(directoryEntries(parentPath));
    if (listed === null) return null;
    const entries = yield* settledEntries(parentPath, listed);
    return entries.filter((entry) => entry.kind === "directory").map((entry) => entry.name);
  });

type TreeWalk = {
  readonly prunedDirectoryNames: readonly string[];
  readonly keepsFileName: (fileName: string) => boolean;
};

const filesBelow = ({
  directory,
  listed,
  walk,
}: {
  readonly directory: string;
  readonly listed: readonly DirectoryEntry[];
  readonly walk: TreeWalk;
}): Effect.Effect<readonly string[], TreeFailure, FileSystem.FileSystem> =>
  Effect.gen(function* walkedFiles() {
    const entries = yield* settledEntries(directory, listed);
    const found = yield* Effect.forEach(entries, (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.kind === "directory") {
        return walk.prunedDirectoryNames.includes(entry.name)
          ? Effect.succeed([])
          : Effect.flatMap(directoryEntries(entryPath), (nested) =>
              filesBelow({ directory: entryPath, listed: nested, walk }),
            );
      }
      return Effect.succeed(
        entry.kind === "file" && walk.keepsFileName(entry.name) ? [entryPath] : [],
      );
    });
    return found.flat();
  });

export const filesUnder = ({
  directory,
  ...walk
}: TreeWalk & {
  readonly directory: string;
}): Effect.Effect<readonly string[] | null, TreeFailure, FileSystem.FileSystem> =>
  Effect.gen(function* filesUnder() {
    const listed = yield* unlessMissing(directoryEntries(directory));
    if (listed === null) return null;
    const found = yield* filesBelow({ directory, listed, walk });
    return found.toSorted();
  });
