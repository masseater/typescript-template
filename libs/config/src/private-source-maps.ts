import { chmod, mkdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { SOURCE_MAP_MANIFEST, sourceMapDirectories } from "./source-maps.ts";

import type { Plugin } from "vite-plus";
import type { Application } from "./applications.ts";

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

const moveMap = async (source: string, destination: string): Promise<void> => {
  const directory = path.dirname(destination);
  await mkdir(directory, { mode: PRIVATE_DIRECTORY_MODE, recursive: true });
  if ((await realpath(directory)) !== directory) {
    throw new Error(`${directory} must not be an alias`);
  }
  await rename(source, destination);
  await chmod(destination, PRIVATE_FILE_MODE);
};

const recordEmitted = async (
  destination: string,
  sourceMapFiles: readonly string[],
): Promise<void> => {
  await writeFile(
    path.join(destination, SOURCE_MAP_MANIFEST),
    `${JSON.stringify(sourceMapFiles.toSorted())}\n`,
    { mode: PRIVATE_FILE_MODE },
  );
};

const privateSourceMaps = (app: Application): Plugin => {
  const mapDirectory = sourceMapDirectories(repositoryRoot, app).client;
  return {
    apply: "build",
    applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "client",
    name: "template-private-source-maps",
    async writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir;
      if (outDir === undefined) {
        this.error("client output directory is unknown");
      }
      const sourceMapFiles = Object.keys(bundle).filter((file) => file.endsWith(".map"));
      if (sourceMapFiles.length === 0) {
        this.error("client build emitted no source maps");
      }
      await rm(mapDirectory, { force: true, recursive: true });
      await Promise.all(
        sourceMapFiles.map(async (file) =>
          moveMap(path.join(outDir, file), path.join(mapDirectory, file)),
        ),
      );
      await recordEmitted(mapDirectory, sourceMapFiles);
      this.info(
        JSON.stringify({
          audience: app,
          event: "build.source_maps_private",
          moved: sourceMapFiles.length,
        }),
      );
    },
  };
};

export { privateSourceMaps };
