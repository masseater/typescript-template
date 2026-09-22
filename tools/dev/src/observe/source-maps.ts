const { SourceMap } = process.getBuiltinModule("module");

import { sourceMapDirectories } from "@repo/vite-config/source-maps";
import { Effect, FileSystem, Path, PlatformError, Schema } from "effect";

import { isNotFound, withFileSystem } from "../platform.ts";

import type { Application } from "@repo/config";

type App = Application;
type Runtime = "client" | "server";
type DirectoryEntry = Readonly<{
  readonly isDirectory: () => boolean;
  readonly isFile: () => boolean;
  readonly name: string;
}>;
type Frame =
  | {
      readonly location: string;
      readonly resolved: false;
      readonly reason: "location_invalid" | "mapping_missing" | "source_map_missing";
    }
  | {
      readonly location: string;
      readonly resolved: true;
      readonly source: string;
      readonly line: number;
      readonly column: number;
      readonly name?: string;
    };

interface Symbolication {
  readonly repositoryRoot: string;
  readonly app: App;
  readonly release: string;
}

interface ParsedLocation {
  readonly client: boolean;
  readonly column: number;
  readonly filename: string;
  readonly line: number;
}

interface MapCandidate {
  readonly mapFile: string;
  readonly runtime: Runtime;
  readonly runtimeDirectory: string;
}

interface MapLookup extends ParsedLocation, MapCandidate {
  readonly location: string;
}

class SourceMapFailure extends Schema.TaggedError<SourceMapFailure>()("SourceMapFailure", {
  reason: Schema.Literals(["source_map_unreadable", "source_map_invalid"]),
}) {}

const sourceMapVersion = 3;
const Payload = Schema.Struct({
  mappings: Schema.String,
  names: Schema.Array(Schema.String),
  sources: Schema.Array(Schema.String),
  version: Schema.Literal(sourceMapVersion),
});

function unreadable(): SourceMapFailure {
  return new SourceMapFailure({ reason: "source_map_unreadable" });
}

function invalid(): SourceMapFailure {
  return new SourceMapFailure({ reason: "source_map_invalid" });
}

function directoryEntries(
  directory: string,
): Effect.Effect<DirectoryEntry[], SourceMapFailure, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* directoryEntriesProgram() {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const names = yield* fs.readDirectory(directory).pipe(
      Effect.catchIf(
        (error): error is PlatformError.PlatformError => isNotFound(error),
        () => Effect.succeed([]),
      ),
    );
    return yield* Effect.forEach(names, (name) =>
      fs.stat(path.join(directory, name)).pipe(
        Effect.map((info) => ({
          isDirectory: () => info.type === "Directory",
          isFile: () => info.type === "File",
          name,
        })),
      ),
    );
  }).pipe(Effect.mapError(() => unreadable()));
}

function findMap(
  directory: string,
  filename: string,
): Effect.Effect<string | undefined, SourceMapFailure, FileSystem.FileSystem | Path.Path> {
  const entryMap = (
    entryDirectory: string,
    entry: DirectoryEntry,
    mapFilename: string,
  ): Effect.Effect<string | undefined, SourceMapFailure, FileSystem.FileSystem | Path.Path> =>
    Effect.gen(function* entryMapProgram() {
      const path = yield* Path.Path;
      const candidate = path.join(entryDirectory, entry.name);
      if (entry.isFile() && entry.name === `${mapFilename}.map`) {
        return candidate;
      }
      return entry.isDirectory() ? yield* findMap(candidate, mapFilename) : undefined;
    });
  return directoryEntries(directory).pipe(
    Effect.flatMap((entries) =>
      Effect.forEach(entries, (entry: DirectoryEntry) => entryMap(directory, entry, filename)),
    ),
    Effect.map((found) => found.find((candidate) => candidate !== undefined)),
  );
}

function parseLocation(location: string): ParsedLocation | undefined {
  const pattern =
    /^(?<client>\/assets\/)?(?<filename>[\w.-]+\.[cm]?[jt]sx?):(?<line>\d+):(?<column>\d+)$/u;
  const groups = pattern.exec(location)?.groups;
  const filename = groups?.["filename"];
  if (groups === undefined || filename === undefined) {
    return undefined;
  }
  return {
    client: groups["client"] !== undefined,
    column: Number(groups["column"]),
    filename,
    line: Number(groups["line"]),
  };
}

const loadSourceMap = Effect.fn("loadSourceMap")(function* loadSourceMap(
  mapFile: string,
  filename: string,
) {
  const text = yield* withFileSystem((fs) => fs.readFileString(mapFile)).pipe(
    Effect.mapError(unreadable),
  );
  const parsed = yield* Schema.decodeEffect(Schema.fromJsonString(Payload))(text).pipe(
    Effect.mapError(invalid),
  );
  return yield* Effect.try({
    catch: invalid,
    try: () =>
      new SourceMap({
        file: filename,
        mappings: parsed.mappings,
        names: [...parsed.names],
        sourceRoot: "",
        sources: [...parsed.sources],
        sourcesContent: [],
        version: parsed.version,
      }),
  });
});

function repositorySource(
  request: Symbolication,
  lookup: MapLookup,
  fileName: string,
): Effect.Effect<string, never, Path.Path> {
  return Effect.gen(function* repositorySourceProgram() {
    const path = yield* Path.Path;
    return path
      .relative(
        request.repositoryRoot,
        path.resolve(
          path.dirname(
            path.join(
              request.repositoryRoot,
              "apps",
              request.app,
              "dist",
              lookup.runtime,
              path.relative(lookup.runtimeDirectory, lookup.mapFile),
            ),
          ),
          fileName,
        ),
      )
      .replaceAll(path.sep, "/");
  });
}

const resolveWithMap = Effect.fn("resolveWithMap")(function* resolveWithMap(
  request: Symbolication,
  lookup: MapLookup,
) {
  const { column, line, location } = lookup;
  const map = yield* loadSourceMap(lookup.mapFile, lookup.filename);
  const entry = map.findEntry(line - 1, column - 1);
  const origin = map.findOrigin(line, column);
  if (!("generatedLine" in entry) || entry.generatedLine !== line - 1 || !("fileName" in origin)) {
    const missing: Frame = { location, reason: "mapping_missing", resolved: false };
    return missing;
  }
  const name: string = origin.name ?? "";
  const frame: Frame = {
    column: origin.columnNumber,
    line: origin.lineNumber,
    location,
    ...(name === "" ? {} : { name }),
    resolved: true,
    source: yield* repositorySource(request, lookup, origin.fileName),
  };
  return frame;
});

function findCandidate(
  releaseDirectory: string,
  parsed: ParsedLocation,
): Effect.Effect<MapCandidate | undefined, SourceMapFailure, FileSystem.FileSystem | Path.Path> {
  const runtimes: readonly Runtime[] = parsed.client ? ["client"] : ["server", "client"];
  return Effect.gen(function* findCandidateProgram() {
    const path = yield* Path.Path;
    const candidates = yield* Effect.forEach(runtimes, (runtime) => {
      const runtimeDirectory = path.join(releaseDirectory, runtime);
      return findMap(runtimeDirectory, parsed.filename).pipe(
        Effect.map((mapFile): MapCandidate | undefined =>
          mapFile === undefined ? undefined : { mapFile, runtime, runtimeDirectory },
        ),
      );
    });
    return candidates.find((candidate) => candidate !== undefined);
  });
}

const symbolicateLocation = Effect.fn("symbolicateLocation")(function* symbolicateLocation(
  request: Symbolication,
  location: string,
) {
  const parsed = parseLocation(location);
  if (parsed === undefined) {
    const invalidLocation: Frame = { location, reason: "location_invalid", resolved: false };
    return invalidLocation;
  }
  const path = yield* Path.Path;
  const releaseDirectory = path.join(
    sourceMapDirectories(request.repositoryRoot, request.app).releases,
    request.release,
  );
  const match = yield* findCandidate(releaseDirectory, parsed);
  if (match === undefined) {
    const missing: Frame = { location, reason: "source_map_missing", resolved: false };
    return missing;
  }
  return yield* resolveWithMap(request, { ...parsed, ...match, location });
});

function symbolicate(
  request: Symbolication,
  locations: readonly string[],
): Effect.Effect<Frame[], SourceMapFailure, FileSystem.FileSystem | Path.Path> {
  return Effect.forEach(locations, (location) => symbolicateLocation(request, location), {
    concurrency: "unbounded",
  });
}

export { symbolicate };
