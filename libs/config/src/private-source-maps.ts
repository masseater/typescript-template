// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdir, realpath, rename } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import type { Plugin } from "vite-plus";

import type { Application } from "./applications.ts";

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

function privateSourceMapDirectory(app: Application): string {
  return path.join(repositoryRoot, ".local", "source-maps", app, "client");
}

async function moveMap(source: string, target: string): Promise<void> {
  const directory = path.dirname(target);
  await mkdir(directory, { mode: PRIVATE_DIRECTORY_MODE, recursive: true });
  if ((await realpath(directory)) !== directory) {
    throw new Error(`${directory} must not be an alias`);
  }
  await rename(source, target);
  await chmod(target, PRIVATE_FILE_MODE);
}

function privateSourceMaps(app: Application): Plugin {
  const destination = privateSourceMapDirectory(app);
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
      await Promise.all(
        maps.map(async (file) => moveMap(path.join(outDir, file), path.join(destination, file))),
      );
      this.info(
        JSON.stringify({ audience: app, event: "build.source_maps_private", moved: maps.length }),
      );
    },
  };
}

export { privateSourceMaps };
