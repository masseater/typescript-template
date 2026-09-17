// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, copyFile, lstat, mkdir, readdir } from "node:fs/promises";
import type { Application } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import type { Dirent } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;

type MapEntry = Readonly<Pick<Dirent, "isDirectory" | "isFile" | "isSymbolicLink" | "name">>;

interface ArchivedMaps {
  readonly client: number;
  readonly server: number;
}

interface ReleaseArchive {
  readonly release: string;
  readonly repositoryRoot: string;
  readonly target: Application;
}

async function directoryExists(source: string): Promise<boolean> {
  try {
    const information = await lstat(source);
    if (!information.isDirectory()) {
      throw new Error("source_map_directory_invalid");
    }
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function copyMap(from: string, destination: string, to: string): Promise<number> {
  await mkdir(destination, { mode: OWNER_ONLY_DIRECTORY_MODE, recursive: true });
  await copyFile(from, to);
  await chmod(to, OWNER_ONLY_FILE_MODE);
  return 1;
}

async function copyEntry(entry: MapEntry, source: string, destination: string): Promise<number> {
  if (entry.isSymbolicLink()) {
    throw new Error("source_map_symlink_forbidden");
  }
  const from = path.join(source, entry.name);
  const to = path.join(destination, entry.name);
  if (entry.isDirectory()) {
    // oxlint-disable-next-line typescript/no-use-before-define
    return copyMaps(from, to);
  }
  if (entry.isFile() && entry.name.endsWith(".map")) {
    return copyMap(from, destination, to);
  }
  return 0;
}

async function copyMaps(source: string, destination: string): Promise<number> {
  if (!(await directoryExists(source))) {
    return 0;
  }
  const entries = await readdir(source, { withFileTypes: true });
  const copied = await Promise.all(
    entries.map(async (entry: MapEntry) => copyEntry(entry, source, destination)),
  );
  return copied.reduce((total, count) => total + count, 0);
}

async function archiveSourceMaps(archive: ReleaseArchive): Promise<ArchivedMaps> {
  const privateMaps = path.join(archive.repositoryRoot, ".local", "source-maps", archive.target);
  const destination = path.join(privateMaps, "releases", archive.release);
  return {
    client: await copyMaps(path.join(privateMaps, "client"), path.join(destination, "client")),
    server: await copyMaps(
      path.join(archive.repositoryRoot, "apps", archive.target, "dist", "server"),
      path.join(destination, "server"),
    ),
  };
}

export { archiveSourceMaps };
