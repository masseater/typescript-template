import { Effect, Schema } from "effect";

import { filesystem, paths } from "./host.ts";
import { SOURCE_MAP_MANIFEST, sourceMapDirectories } from "./source-maps.ts";

import type { Application } from "@repo/config";
import type { Plugin } from "vite-plus";

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;

const repositoryRoot = paths.resolve(import.meta.dirname, "../../..");

const BROKEN_SOURCE_MAP = "SOURCEMAP_BROKEN";

const failOnBrokenSourceMaps = (): Plugin => {
  return {
    apply: "build",
    name: "template-fail-on-broken-source-maps",
    onLog(_level, log) {
      if (log.code === BROKEN_SOURCE_MAP) {
        this.error(log);
      }
    },
  };
};

const moveMap = (source: string, destination: string) =>
  Effect.gen(function* moveMapProgram() {
    const directory = paths.dirname(destination);
    yield* filesystem.makeDirectory(directory, { mode: PRIVATE_DIRECTORY_MODE, recursive: true });
    if ((yield* filesystem.realPath(directory)) !== directory) {
      return yield* Effect.die(`${directory} must not be an alias`);
    }
    yield* filesystem.rename(source, destination);
    yield* filesystem.chmod(destination, PRIVATE_FILE_MODE);
  }).pipe(Effect.orDie);

const recordEmitted = (destination: string, sourceMapFiles: readonly string[]) =>
  Effect.gen(function* recordEmittedProgram() {
    const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
      sourceMapFiles.toSorted(),
    );
    yield* filesystem.writeFileString(
      paths.join(destination, SOURCE_MAP_MANIFEST),
      `${encoded}\n`,
      { mode: PRIVATE_FILE_MODE },
    );
  }).pipe(Effect.orDie);

const privateSourceMaps = (app: Application): Plugin => {
  const mapDirectory = sourceMapDirectories(repositoryRoot, app).client;
  return {
    apply: "build",
    applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "client",
    name: "template-private-source-maps",
    writeBundle(outputOptions, bundle) {
      const plugin = this;
      return Effect.runPromise(
        Effect.gen(function* writePrivateMaps() {
          const outDir = outputOptions.dir;
          if (outDir === undefined) {
            return plugin.error("client output directory is unknown");
          }
          const sourceMapFiles = Object.keys(bundle).filter((file) => file.endsWith(".map"));
          if (sourceMapFiles.length === 0) {
            return plugin.error("client build emitted no source maps");
          }
          yield* filesystem.remove(mapDirectory, { force: true, recursive: true });
          yield* Effect.forEach(
            sourceMapFiles,
            (file) => moveMap(paths.join(outDir, file), paths.join(mapDirectory, file)),
            { concurrency: "unbounded" },
          );
          yield* recordEmitted(mapDirectory, sourceMapFiles);
          plugin.info(
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              audience: app,
              event: "build.source_maps_private",
              moved: sourceMapFiles.length,
            }).pipe(Effect.orDie),
          );
        }),
      );
    },
  };
};

export { failOnBrokenSourceMaps, privateSourceMaps };
