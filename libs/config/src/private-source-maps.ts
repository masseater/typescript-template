// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdir, realpath, rename, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { SOURCE_MAP_MANIFEST, sourceMapDirectories } from "./source-maps.ts";

import type { Plugin } from "vite-plus";
import type { Application } from "./applications.ts";

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

async function moveMap(source: string, target: string): Promise<void> {
  const directory = path.dirname(target);
  await mkdir(directory, { mode: PRIVATE_DIRECTORY_MODE, recursive: true });
  if ((await realpath(directory)) !== directory) {
    throw new Error(`${directory} must not be an alias`);
  }
  await rename(source, target);
  await chmod(target, PRIVATE_FILE_MODE);
}

async function recordEmitted(destination: string, maps: readonly string[]): Promise<void> {
  await writeFile(
    path.join(destination, SOURCE_MAP_MANIFEST),
    `${JSON.stringify(maps.toSorted())}\n`,
    {
      mode: PRIVATE_FILE_MODE,
    },
  );
}

const BROKEN_SOURCE_MAP = "SOURCEMAP_BROKEN";

function failOnBrokenSourceMaps(): Plugin {
  return {
    apply: "build",
    name: "template-fail-on-broken-source-maps",
    onLog(_level, log) {
      if (log.code === BROKEN_SOURCE_MAP) {
        this.error(log);
      }
    },
  };
}

function privateSourceMaps(app: Application): Plugin {
  const destination = sourceMapDirectories(repositoryRoot, app).client;
  return {
    apply: "build",
    applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "client",
    name: "template-private-source-maps",
    async writeBundle(options, bundle) {
      const outDir = options.dir;
      if (outDir === undefined) {
        this.error("client output directory is unknown");
      }
      const maps = Object.keys(bundle).filter((file) => file.endsWith(".map"));
      if (maps.length === 0) {
        this.error("client build emitted no source maps");
      }
      await rm(destination, { force: true, recursive: true });
      await Promise.all(
        maps.map(async (file) => moveMap(path.join(outDir, file), path.join(destination, file))),
      );
      await recordEmitted(destination, maps);
      this.info(
        JSON.stringify({ audience: app, event: "build.source_maps_private", moved: maps.length }),
      );
    },
  };
}

export { failOnBrokenSourceMaps, privateSourceMaps };
