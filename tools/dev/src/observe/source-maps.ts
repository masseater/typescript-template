// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, readdir } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { SourceMap } from "node:module";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { sourceMapDirectories } from "@repo/config/source-maps";
import { Effect, Schema } from "effect";

// oxlint-disable-next-line import/no-nodejs-modules
import type { Dirent } from "node:fs";
import type { Application } from "@repo/config";

type App = Application;
type Runtime = "client" | "server";
type DirectoryEntry = Readonly<Pick<Dirent, "isDirectory" | "isFile" | "name">>;
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

function isMissing(cause: unknown): boolean {
  return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
}

function directoryEntries(directory: string): Effect.Effect<Dirent[], SourceMapFailure> {
  return Effect.tryPromise({
    catch: (cause): Readonly<{ missing: boolean }> => ({ missing: isMissing(cause) }),
    try: async () => readdir(directory, { withFileTypes: true }),
  }).pipe(
    Effect.matchEffect({
      onFailure: ({ missing }) => (missing ? Effect.succeed([]) : Effect.fail(unreadable())),
      onSuccess: (entries) => Effect.succeed(entries),
    }),
  );
}

function entryMap(
  directory: string,
  entry: DirectoryEntry,
  filename: string,
): Effect.Effect<string | undefined, SourceMapFailure> {
  const candidate = path.join(directory, entry.name);
  if (entry.isFile() && entry.name === `${filename}.map`) {
    return Effect.succeed(candidate);
  }
  // oxlint-disable-next-line typescript/no-use-before-define
  return entry.isDirectory() ? findMap(candidate, filename) : Effect.undefined;
}

function findMap(
  directory: string,
  filename: string,
): Effect.Effect<string | undefined, SourceMapFailure> {
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
  const text = yield* Effect.tryPromise({
    catch: unreadable,
    try: async () => readFile(mapFile, "utf-8"),
  });
  const parsed = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Payload))(text).pipe(
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

function repositorySource(request: Symbolication, lookup: MapLookup, fileName: string): string {
  const builtFile = path.join(
    request.repositoryRoot,
    "apps",
    request.app,
    "dist",
    lookup.runtime,
    path.relative(lookup.runtimeDirectory, lookup.mapFile),
  );
  return path
    .relative(request.repositoryRoot, path.resolve(path.dirname(builtFile), fileName))
    .replaceAll(path.sep, "/");
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
    source: repositorySource(request, lookup, origin.fileName),
  };
  return frame;
});

function findCandidate(
  releaseDirectory: string,
  parsed: ParsedLocation,
): Effect.Effect<MapCandidate | undefined, SourceMapFailure> {
  const runtimes: readonly Runtime[] = parsed.client ? ["client"] : ["server", "client"];
  return Effect.forEach(runtimes, (runtime) => {
    const runtimeDirectory = path.join(releaseDirectory, runtime);
    return findMap(runtimeDirectory, parsed.filename).pipe(
      Effect.map((mapFile): MapCandidate | undefined =>
        mapFile === undefined ? undefined : { mapFile, runtime, runtimeDirectory },
      ),
    );
  }).pipe(Effect.map((candidates) => candidates.find((candidate) => candidate !== undefined)));
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
): Effect.Effect<Frame[], SourceMapFailure> {
  return Effect.forEach(locations, (location) => symbolicateLocation(request, location), {
    concurrency: "unbounded",
  });
}

export { symbolicate };
