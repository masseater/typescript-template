import { chmod, copyFile, lstat, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import type { Application } from "@template/config";

async function copyMaps(source: string, destination: string): Promise<number> {
  const information = await lstat(source).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  });
  if (!information) return 0;
  if (!information.isDirectory()) throw new Error("source_map_directory_invalid");
  let copied = 0;
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("source_map_symlink_forbidden");
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copied += await copyMaps(from, to);
    else if (entry.isFile() && entry.name.endsWith(".map")) {
      await mkdir(destination, { recursive: true, mode: 0o700 });
      await copyFile(from, to);
      await chmod(to, 0o600);
      copied += 1;
    }
  }
  return copied;
}

export async function archiveSourceMaps(
  repositoryRoot: string,
  target: Application,
  release: string,
) {
  const privateMaps = path.join(repositoryRoot, ".local", "source-maps", target);
  const destination = path.join(privateMaps, "releases", release);
  return {
    server: await copyMaps(
      path.join(repositoryRoot, "apps", target, "dist", "server"),
      path.join(destination, "server"),
    ),
    client: await copyMaps(path.join(privateMaps, "client"), path.join(destination, "client")),
  };
}
