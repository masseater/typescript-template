import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import { directoryEntries } from "./directory-entries.ts";

layer(NodeServices.layer)("directory entries", (it) => {
  it.effect("tells directories and files apart from every symlink", () =>
    Effect.gen(function* program() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "directory-entries-" });
      yield* filesystem.writeFileString(paths.join(root, "file.txt"), "held");
      yield* filesystem.makeDirectory(paths.join(root, "directory"));
      yield* filesystem.symlink(paths.join(root, "directory"), paths.join(root, "to-directory"));
      yield* filesystem.symlink(paths.join(root, "file.txt"), paths.join(root, "to-file"));
      yield* filesystem.symlink(paths.join(root, "missing"), paths.join(root, "dangling"));

      const entries = yield* directoryEntries(root);

      expect(entries.toSorted((left, right) => left.name.localeCompare(right.name))).toStrictEqual([
        { kind: "other", name: "dangling" },
        { kind: "directory", name: "directory" },
        { kind: "file", name: "file.txt" },
        { kind: "other", name: "to-directory" },
        { kind: "other", name: "to-file" },
      ]);
    }),
  );
});
