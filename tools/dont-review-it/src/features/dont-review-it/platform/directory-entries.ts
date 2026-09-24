import { Effect, FileSystem, type Path, type PlatformError, Schema } from "effect";

import { unlessMissing } from "./file-system.ts";
import { isLinkLoop, isMissingPath, isNotALink } from "./path-failure.ts";
import { path } from "./path.ts";

export type EntryKind = "directory" | "file" | "other";

export interface DirectoryEntry {
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

class EscapingSymlink extends Schema.TaggedError<EscapingSymlink>()("EscapingSymlink", {
  path: Schema.String,
  target: Schema.String,
  root: Schema.String,
}) {
  override get message(): string {
    return `${this.path} is a symbolic link to ${this.target}, outside ${this.root}, so what it holds is not part of the tree being read.`;
  }
}

class SymlinkCycle extends Schema.TaggedError<SymlinkCycle>()("SymlinkCycle", {
  path: Schema.String,
  target: Schema.String,
}) {
  override get message(): string {
    return `${this.path} leads back into ${this.target}, which already encloses it, so following it would never end.`;
  }
}

export type TreeFailure =
  | PlatformError.PlatformError
  | DanglingSymlink
  | EscapingSymlink
  | SymlinkCycle;

export type TreeScan<Scanned> = Effect.Effect<
  Scanned,
  TreeFailure,
  FileSystem.FileSystem | Path.Path
>;

type Descent = Readonly<{
  root: string;
  realRoot: string;
  enclosing: readonly string[];
}>;

type ResolvedEntry = DirectoryEntry & Readonly<{ realPath: string }>;

type EntryUse = (entry: DirectoryEntry) => boolean;

type Listing = Readonly<{
  directory: string;
  realDirectory: string;
  names: readonly string[];
  descent: Descent;
  uses: EntryUse;
}>;

const isWithin = (realRoot: string, realPath: string): boolean => {
  const relative = path.relative(realRoot, realPath);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

const kindOf = (type: FileSystem.File.Type): EntryKind =>
  type === "Directory" ? "directory" : type === "File" ? "file" : "other";

const linkedEntry = ({
  entryPath,
  linkText,
  descent,
  uses,
}: Readonly<{
  entryPath: string;
  linkText: string;
  descent: Descent;
  uses: EntryUse;
}>): Effect.Effect<ResolvedEntry | null, TreeFailure, FileSystem.FileSystem> =>
  Effect.gen(function* linkedEntry() {
    const filesystem = yield* FileSystem.FileSystem;
    const { type } = yield* filesystem.stat(entryPath).pipe(
      Effect.mapError((failure): TreeFailure => {
        if (isMissingPath(failure)) return new DanglingSymlink({ path: entryPath });
        if (isLinkLoop(failure)) return new SymlinkCycle({ path: entryPath, target: linkText });
        return failure;
      }),
    );
    const entry = { kind: kindOf(type), name: path.basename(entryPath) };
    if (!uses(entry)) return null;
    const realPath = yield* filesystem.realPath(entryPath);
    if (!isWithin(descent.realRoot, realPath)) {
      return yield* new EscapingSymlink({ path: entryPath, target: realPath, root: descent.root });
    }
    return { ...entry, realPath };
  });

const resolvedEntry = ({
  directory,
  realDirectory,
  name,
  descent,
  uses,
}: Omit<Listing, "names"> & Readonly<{ name: string }>): Effect.Effect<
  ResolvedEntry | null,
  TreeFailure,
  FileSystem.FileSystem
> =>
  Effect.gen(function* resolvedEntry() {
    const filesystem = yield* FileSystem.FileSystem;
    const entryPath = path.join(directory, name);
    const linkText = yield* filesystem
      .readLink(entryPath)
      .pipe(Effect.catchIf(isNotALink, () => Effect.succeed(null)));
    const resolved =
      linkText === null
        ? yield* Effect.map(filesystem.stat(entryPath), ({ type }) => {
            const entry = { kind: kindOf(type), name };
            return uses(entry) ? { ...entry, realPath: path.join(realDirectory, name) } : null;
          })
        : yield* linkedEntry({ entryPath, linkText, descent, uses });
    if (resolved?.kind === "directory" && descent.enclosing.includes(resolved.realPath)) {
      return yield* new SymlinkCycle({ path: entryPath, target: resolved.realPath });
    }
    return resolved;
  });

const resolvedEntries = ({
  names,
  ...listing
}: Listing): Effect.Effect<readonly ResolvedEntry[], TreeFailure, FileSystem.FileSystem> =>
  Effect.map(
    Effect.forEach(names.toSorted(), (name) => resolvedEntry({ ...listing, name }), {
      concurrency: "unbounded",
    }),
    (resolved) => resolved.filter((entry) => entry !== null),
  );

const rootListing = (
  root: string,
  uses: EntryUse,
): Effect.Effect<Listing, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* rootListing() {
    const filesystem = yield* FileSystem.FileSystem;
    const realRoot = yield* filesystem.realPath(root);
    return {
      directory: root,
      realDirectory: realRoot,
      names: yield* filesystem.readDirectory(root),
      descent: { root, realRoot, enclosing: [realRoot] },
      uses,
    };
  });

export const directoryEntries = (
  directory: string,
): Effect.Effect<readonly DirectoryEntry[], TreeFailure, FileSystem.FileSystem> =>
  Effect.map(
    Effect.flatMap(
      rootListing(directory, () => true),
      resolvedEntries,
    ),
    (entries) => entries.map(({ kind, name }) => ({ kind, name })),
  );

export const childDirectoryNamesIn = (
  parentPath: string,
): Effect.Effect<readonly string[] | null, TreeFailure, FileSystem.FileSystem> =>
  Effect.gen(function* childDirectoryNamesIn() {
    const listing = yield* unlessMissing(
      rootListing(parentPath, (entry) => entry.kind === "directory"),
    );
    if (listing === null) return null;
    const entries = yield* resolvedEntries(listing);
    return entries.map((entry) => entry.name);
  });

export type TreeWalk = {
  readonly prunedDirectoryNames: readonly string[];
  readonly keepsFileName: (fileName: string) => boolean;
};

const filesBelow = (
  listing: Listing,
): Effect.Effect<readonly string[], TreeFailure, FileSystem.FileSystem> =>
  Effect.gen(function* walkedFiles() {
    const filesystem = yield* FileSystem.FileSystem;
    const entries = yield* resolvedEntries(listing);
    const found = yield* Effect.forEach(entries, (entry) => {
      const entryPath = path.join(listing.directory, entry.name);
      if (entry.kind !== "directory") return Effect.succeed([entryPath]);
      return Effect.flatMap(filesystem.readDirectory(entryPath), (names) =>
        filesBelow({
          ...listing,
          directory: entryPath,
          realDirectory: entry.realPath,
          names,
          descent: {
            ...listing.descent,
            enclosing: [...listing.descent.enclosing, entry.realPath],
          },
        }),
      );
    });
    return found.flat();
  });

export const filesUnder = ({
  directory,
  prunedDirectoryNames,
  keepsFileName,
}: TreeWalk & {
  readonly directory: string;
}): Effect.Effect<readonly string[] | null, TreeFailure, FileSystem.FileSystem> =>
  Effect.gen(function* filesUnder() {
    const listing = yield* unlessMissing(
      rootListing(directory, (entry) =>
        entry.kind === "directory"
          ? !prunedDirectoryNames.includes(entry.name)
          : entry.kind === "file" && keepsFileName(entry.name),
      ),
    );
    if (listing === null) return null;
    const found = yield* filesBelow(listing);
    return found.toSorted();
  });
export type { DanglingSymlink, EscapingSymlink, SymlinkCycle };
