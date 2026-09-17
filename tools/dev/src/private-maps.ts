// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdir, readdir, realpath, rename } from "node:fs/promises";
import { privateDirectoryMode, privateFileMode } from "./private-files.ts";
import { applications } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

const root = fileURLToPath(new URL("../../../", import.meta.url));

interface MapTarget {
  readonly destination: string;
  readonly source: string;
}

async function sourceMaps(directory: string): Promise<string[]> {
  if ((await realpath(directory)) !== directory) {
    throw new Error("Source map directory alias is forbidden");
  }
  const entries = await readdir(directory, { withFileTypes: true });
  type Entry = Readonly<(typeof entries)[number]>;
  if (entries.some((entry: Entry) => entry.isSymbolicLink())) {
    throw new Error("Source map symlink is forbidden");
  }
  const nested = await Promise.all(
    entries
      .filter((entry: Entry) => entry.isDirectory())
      .map(async (entry: Entry) => sourceMaps(path.join(directory, entry.name))),
  );
  const files = entries
    .filter((entry: Entry) => entry.isFile() && entry.name.endsWith(".map"))
    .map((entry: Entry) => path.join(directory, entry.name));
  return [...files, ...nested.flat()];
}

async function movePrivately({ destination, source }: MapTarget, file: string): Promise<void> {
  const target = path.join(destination, path.relative(source, file));
  const targetDirectory = path.dirname(target);
  await mkdir(targetDirectory, { mode: privateDirectoryMode, recursive: true });
  if ((await realpath(targetDirectory)) !== targetDirectory) {
    throw new Error("Private source map directory alias is forbidden");
  }
  await rename(file, target);
  await chmod(target, privateFileMode);
}

async function movePrivateMaps(audience: string): Promise<string> {
  const target = {
    destination: path.join(root, ".local", "source-maps", audience, "client"),
    source: path.join(root, "apps", audience, "dist/client"),
  };
  const maps = await sourceMaps(target.source);
  await Promise.all(
    maps.map(async (file) => {
      await movePrivately(target, file);
    }),
  );
  return `${JSON.stringify({ audience, event: "build.source_maps_private", moved: maps.length })}\n`;
}

const reports = await Promise.all(applications.map(async (audience) => movePrivateMaps(audience)));
process.stdout.write(reports.join(""));
