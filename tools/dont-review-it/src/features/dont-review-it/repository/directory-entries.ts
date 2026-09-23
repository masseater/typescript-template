import { Effect, FileSystem, Path, type PlatformError } from "effect";

type EntryKind = "directory" | "file" | "other";

interface DirectoryEntry {
  readonly kind: EntryKind;
  readonly name: string;
}

const entryKind = (
  entryPath: string,
): Effect.Effect<EntryKind, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* entryKind() {
    const filesystem = yield* FileSystem.FileSystem;
    const linked = yield* filesystem.readLink(entryPath).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false),
    );
    if (linked) {
      return "other";
    }
    const { type } = yield* filesystem.stat(entryPath);
    return type === "Directory" ? "directory" : type === "File" ? "file" : "other";
  });

const directoryEntries = (
  directory: string,
): Effect.Effect<
  readonly DirectoryEntry[],
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* directoryEntries() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const names = yield* filesystem.readDirectory(directory);
    return yield* Effect.forEach(
      names,
      (name) => Effect.map(entryKind(paths.join(directory, name)), (kind) => ({ kind, name })),
      { concurrency: "unbounded" },
    );
  });

export { directoryEntries, entryKind };
