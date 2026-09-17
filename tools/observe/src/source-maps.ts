import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { SourceMap } from "node:module";
import path from "node:path";
import type { Application } from "@template/config";
import { Effect, Schema } from "effect";

export class SourceMapFailure extends Schema.TaggedError<SourceMapFailure>()("SourceMapFailure", {
  reason: Schema.Literals(["source_map_unreadable", "source_map_invalid"]),
}) {}

const Payload = Schema.Struct({
  version: Schema.Literal(3),
  sources: Schema.Array(Schema.String),
  names: Schema.Array(Schema.String),
  mappings: Schema.String,
});

const unreadable = () => new SourceMapFailure({ reason: "source_map_unreadable" });
const invalid = () => new SourceMapFailure({ reason: "source_map_invalid" });

const findMap: (
  directory: string,
  filename: string,
) => Effect.Effect<string | undefined, SourceMapFailure> = Effect.fn("findMap")(function* (
  directory: string,
  filename: string,
) {
  const entries = yield* Effect.tryPromise({
    try: () =>
      readdir(directory, { withFileTypes: true }).catch(
        (error: unknown): Dirent[] | Promise<never> =>
          error && typeof error === "object" && "code" in error && error.code === "ENOENT"
            ? []
            : Promise.reject(error),
      ),
    catch: unreadable,
  });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === `${filename}.map`) return candidate;
    if (entry.isDirectory()) {
      const nested = yield* findMap(candidate, filename);
      if (nested) return nested;
    }
  }
  return undefined;
});

export const symbolicate = Effect.fn("symbolicate")(function* (
  repositoryRoot: string,
  app: Application,
  release: string,
  locations: readonly string[],
) {
  const releaseDirectory = path.join(
    repositoryRoot,
    ".local",
    "source-maps",
    app,
    "releases",
    release,
  );
  return yield* Effect.forEach(
    locations,
    (location) =>
      Effect.gen(function* () {
        const match = /^(\/assets\/)?([\w.-]+\.[cm]?[jt]sx?):(\d+):(\d+)$/.exec(location);
        if (!match?.[2]) return { location, resolved: false as const, reason: "location_invalid" };
        const [, client, filename, line, column] = match;
        const runtimes = client ? (["client"] as const) : (["server", "client"] as const);
        for (const runtime of runtimes) {
          const runtimeDirectory = path.join(releaseDirectory, runtime);
          const mapFile = yield* findMap(runtimeDirectory, filename);
          if (!mapFile) continue;
          const text = yield* Effect.tryPromise({
            try: () => readFile(mapFile, "utf8"),
            catch: unreadable,
          });
          const json = yield* Effect.try({ try: (): unknown => JSON.parse(text), catch: invalid });
          const parsed = yield* Schema.decodeUnknownEffect(Payload)(json).pipe(
            Effect.mapError(invalid),
          );
          const map = yield* Effect.try({
            try: () =>
              new SourceMap({
                file: filename,
                sourceRoot: "",
                sourcesContent: [],
                version: parsed.version,
                sources: [...parsed.sources],
                names: [...parsed.names],
                mappings: parsed.mappings,
              }),
            catch: invalid,
          });
          const lineNumber = Number(line);
          const columnNumber = Number(column);
          const entry = map.findEntry(lineNumber - 1, columnNumber - 1);
          if (!("generatedLine" in entry) || entry.generatedLine !== lineNumber - 1)
            return { location, resolved: false as const, reason: "mapping_missing" };
          const origin = map.findOrigin(lineNumber, columnNumber);
          if (!("fileName" in origin))
            return { location, resolved: false as const, reason: "mapping_missing" };
          const builtFile = path.join(
            repositoryRoot,
            "apps",
            app,
            "dist",
            runtime,
            path.relative(runtimeDirectory, mapFile),
          );
          return {
            location,
            resolved: true as const,
            source: path
              .relative(repositoryRoot, path.resolve(path.dirname(builtFile), origin.fileName))
              .replaceAll(path.sep, "/"),
            line: origin.lineNumber,
            column: origin.columnNumber,
            ...(origin.name ? { name: origin.name } : {}),
          };
        }
        return { location, resolved: false as const, reason: "source_map_missing" };
      }),
    { concurrency: "unbounded" },
  );
});
