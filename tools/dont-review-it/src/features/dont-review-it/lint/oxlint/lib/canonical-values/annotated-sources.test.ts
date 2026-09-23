import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { readAnnotatedSources } from "./annotated-sources.ts";
import { listRepositoryFiles } from "./source-files.ts";

const ANNOTATED_USER_STATUS = `/** @canonical-values user.status */
export const STATUSES = ["draft"] as const;
`;

const ANNOTATED_ARTICLE_STATUS = `/** @canonical-values article.status */
export const STATUSES = ["draft"] as const;
`;

layer(NodeServices.layer)("readAnnotatedSources", (it) => {
  describe("a source that vanished after the listing", () => {
    const fixture = Effect.gen(function* paths() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "annotated-sources-" });

      yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(root, "src/gone.ts"),
        ANNOTATED_USER_STATUS,
      );
      yield* filesystem.writeFileString(
        pathService.join(root, "src/kept.ts"),
        ANNOTATED_ARTICLE_STATUS,
      );
      const listed = listRepositoryFiles(root);
      yield* filesystem.remove(pathService.join(root, "src/gone.ts"));
      return readAnnotatedSources(listed).map((source) => source.relativePath);
    });

    it.effect("is left out instead of stopping the scan", () =>
      Effect.gen(function* program() {
        const paths = yield* fixture;
        expect(paths).toStrictEqual(["src/kept.ts"]);
      }),
    );
  });

  describe("a source carrying no annotation", () => {
    const fixture = Effect.gen(function* paths() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "annotated-sources-" });

      yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(root, "src/plain.ts"),
        "export const total = 1;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(root, "src/annotated.ts"),
        ANNOTATED_USER_STATUS,
      );
      return readAnnotatedSources(listRepositoryFiles(root)).map((source) => source.relativePath);
    });

    it.effect("is left out", () =>
      Effect.gen(function* program() {
        const paths = yield* fixture;
        expect(paths).toStrictEqual(["src/annotated.ts"]);
      }),
    );
  });

  describe("an annotated test file", () => {
    const fixture = Effect.gen(function* declarations() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "annotated-sources-" });

      yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(root, "src/user.test.ts"),
        ANNOTATED_USER_STATUS,
      );
      return readAnnotatedSources(listRepositoryFiles(root)).map((source) => source.declarations);
    });

    it.effect("carries its problems but declares no concept", () =>
      Effect.gen(function* program() {
        const declarations = yield* fixture;
        expect(declarations).toStrictEqual([[]]);
      }),
    );
  });
});
