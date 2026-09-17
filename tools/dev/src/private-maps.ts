import { chmod, mkdir, readdir, realpath, rename } from "node:fs/promises";
import { parse, picklist } from "valibot";
import { privateDirectoryMode, privateFileMode } from "./private-files.ts";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const audience = parse(picklist(["user", "admin", "wiki"]), process.argv[2]);
const source = path.join(root, "apps", audience, "dist/client");
const destination = path.join(root, ".local", "source-maps", audience, "client");

async function sourceMaps(directory: string): Promise<string[]> {
  if ((await realpath(directory)) !== directory) {
    throw new Error("Source map directory alias is forbidden");
  }
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => entry.isSymbolicLink())) {
    throw new Error("Source map symlink is forbidden");
  }
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => sourceMaps(path.join(directory, entry.name))),
  );
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".map"))
    .map((entry) => path.join(directory, entry.name));
  return [...files, ...nested.flat()];
}

async function movePrivately(file: string): Promise<void> {
  const target = path.join(destination, path.relative(source, file));
  const targetDirectory = path.dirname(target);
  await mkdir(targetDirectory, { mode: privateDirectoryMode, recursive: true });
  if ((await realpath(targetDirectory)) !== targetDirectory) {
    throw new Error("Private source map directory alias is forbidden");
  }
  await rename(file, target);
  await chmod(target, privateFileMode);
}

const maps = await sourceMaps(source);
await Promise.all(
  maps.map(async (file) => {
    await movePrivately(file);
  }),
);
process.stdout.write(
  `${JSON.stringify({ audience, event: "build.source_maps_private", moved: maps.length })}\n`,
);
