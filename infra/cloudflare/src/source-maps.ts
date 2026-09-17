import { chmod, copyFile, lstat, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { fail, io } from "./artifacts.ts";
import type { ArtifactFailure } from "./artifacts.ts";
import type { AppTarget } from "./config.ts";

const copyMaps: (source: string, destination: string) => Effect.Effect<number, ArtifactFailure> =
  Effect.fn("copyMaps")(function* (source: string, destination: string) {
    const information = yield* Effect.tryPromise({
      try: () => lstat(source),
      catch: (cause) => ({ cause }),
    }).pipe(
      Effect.catch(({ cause: error }) =>
        error instanceof Error && "code" in error && error.code === "ENOENT"
          ? Effect.succeed(undefined)
          : fail("artifact_io_failed"),
      ),
    );
    if (!information) return 0;
    if (!information.isDirectory()) return yield* fail("source_map_directory_invalid");
    let copied = 0;
    for (const entry of yield* io(() => readdir(source, { withFileTypes: true }))) {
      if (entry.isSymbolicLink()) return yield* fail("source_map_symlink_forbidden");
      const from = path.join(source, entry.name);
      const to = path.join(destination, entry.name);
      if (entry.isDirectory()) copied += yield* copyMaps(from, to);
      else if (entry.isFile() && entry.name.endsWith(".map")) {
        yield* io(async () => {
          await mkdir(destination, { recursive: true, mode: 0o700 });
          await copyFile(from, to);
          await chmod(to, 0o600);
        });
        copied += 1;
      }
    }
    return copied;
  });

export const archiveSourceMaps = Effect.fn("archiveSourceMaps")(function* (
  repositoryRoot: string,
  target: AppTarget,
  release: string,
) {
  const privateMaps = path.join(repositoryRoot, ".local", "source-maps", target);
  const destination = path.join(privateMaps, "releases", release);
  return {
    server: yield* copyMaps(
      path.join(repositoryRoot, "apps", target, "dist", "server"),
      path.join(destination, "server"),
    ),
    client: yield* copyMaps(path.join(privateMaps, "client"), path.join(destination, "client")),
  };
});
