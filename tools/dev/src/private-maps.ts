import { chmod, mkdir, readdir, realpath, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applications } from "@template/config";

const root = fileURLToPath(new URL("../../../", import.meta.url));

async function moveMaps(source: string, destination: string, directory = source): Promise<number> {
  if ((await realpath(directory)) !== directory)
    throw new Error("Source map directory alias is forbidden");
  let moved = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("Source map symlink is forbidden");
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) moved += await moveMaps(source, destination, file);
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
  return moved;
}

for (const application of applications) {
  const moved = await moveMaps(
    path.join(root, "apps", application, "dist/client"),
    path.join(root, ".local", "source-maps", application, "client"),
  );
  console.log(JSON.stringify({ event: "build.source_maps_private", audience: application, moved }));
}
