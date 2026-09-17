import { chmod, mkdir, readdir, realpath, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as v from "valibot";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const audience = v.parse(v.picklist(["user", "admin", "wiki"]), process.argv[2]);
const source = path.join(root, "apps", audience, "dist/client");
const destination = path.join(root, ".local", "source-maps", audience, "client");
let moved = 0;

async function moveMaps(directory: string) {
  if ((await realpath(directory)) !== directory)
    throw new Error("Source map directory alias is forbidden");
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("Source map symlink is forbidden");
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await moveMaps(file);
    else if (entry.isFile() && entry.name.endsWith(".map")) {
      const target = path.join(destination, path.relative(source, file));
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      if ((await realpath(path.dirname(target))) !== path.dirname(target))
        throw new Error("Private source map directory alias is forbidden");
      await rename(file, target);
      await chmod(target, 0o600);
      moved += 1;
    }
  }
}

await moveMaps(source);
console.log(JSON.stringify({ event: "build.source_maps_private", audience, moved }));
