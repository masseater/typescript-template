import { array, literal, looseObject, parse, string } from "valibot";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, readdir } from "node:fs/promises";
import type { Application } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import type { Dirent } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import { SourceMap } from "node:module";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

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

const sourceMapVersion = 3;
const payload = looseObject({
  mappings: string(),
  names: array(string()),
  sources: array(string()),
  version: literal(sourceMapVersion),
});

async function directoryEntries(directory: string): Promise<Dirent[]> {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function findMap(directory: string, filename: string): Promise<string | undefined> {
  const entries = await directoryEntries(directory);
  const found = await Promise.all(
    entries.map(async (entry: DirectoryEntry) => {
      const candidate = path.join(directory, entry.name);
      if (entry.isFile() && entry.name === `${filename}.map`) {
        return candidate;
      }
      return entry.isDirectory() ? findMap(candidate, filename) : undefined;
    }),
  );
  return found.find((candidate) => candidate !== undefined);
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

async function loadSourceMap(mapFile: string, filename: string): Promise<SourceMap> {
  const parsed = parse(payload, JSON.parse(await readFile(mapFile, "utf-8")));
  return new SourceMap({
    file: filename,
    mappings: parsed.mappings,
    names: parsed.names,
    sourceRoot: "",
    sources: parsed.sources,
    sourcesContent: [],
    version: parsed.version,
  });
}

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

async function resolveWithMap(request: Symbolication, lookup: MapLookup): Promise<Frame> {
  const { column, line, location } = lookup;
  const map = await loadSourceMap(lookup.mapFile, lookup.filename);
  const entry = map.findEntry(line - 1, column - 1);
  if (!("generatedLine" in entry) || entry.generatedLine !== line - 1) {
    return { location, reason: "mapping_missing", resolved: false };
  }
  const origin = map.findOrigin(line, column);
  if (!("fileName" in origin)) {
    return { location, reason: "mapping_missing", resolved: false };
  }
  const name: string = origin.name ?? "";
  return {
    column: origin.columnNumber,
    line: origin.lineNumber,
    location,
    ...(name === "" ? {} : { name }),
    resolved: true,
    source: repositorySource(request, lookup, origin.fileName),
  };
}

async function findCandidate(
  releaseDirectory: string,
  parsed: ParsedLocation,
): Promise<MapCandidate | undefined> {
  const runtimes: readonly Runtime[] = parsed.client ? ["client"] : ["server", "client"];
  const candidates = await Promise.all(
    runtimes.map(async (runtime): Promise<MapCandidate | undefined> => {
      const runtimeDirectory = path.join(releaseDirectory, runtime);
      const mapFile = await findMap(runtimeDirectory, parsed.filename);
      return mapFile === undefined ? undefined : { mapFile, runtime, runtimeDirectory };
    }),
  );
  return candidates.find((candidate) => candidate !== undefined);
}

async function symbolicateLocation(request: Symbolication, location: string): Promise<Frame> {
  const parsed = parseLocation(location);
  if (parsed === undefined) {
    return { location, reason: "location_invalid", resolved: false };
  }
  const releaseDirectory = path.join(
    request.repositoryRoot,
    ".local",
    "source-maps",
    request.app,
    "releases",
    request.release,
  );
  const match = await findCandidate(releaseDirectory, parsed);
  if (match === undefined) {
    return { location, reason: "source_map_missing", resolved: false };
  }
  return resolveWithMap(request, { ...parsed, ...match, location });
}

async function symbolicate(request: Symbolication, locations: readonly string[]): Promise<Frame[]> {
  return Promise.all(locations.map(async (location) => symbolicateLocation(request, location)));
}

export { symbolicate };
