// @effect-diagnostics-next-line nodeBuiltinImport:off
import { readFileSync } from "node:fs";

import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { loadStyleClassIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const VANISHED_FILE_NAME = "vanished.css";

const ORPHAN_STYLE_SHEET = ".orphan {\n  color: red;\n}\n";

const ORPHAN_SITES = [{ name: "orphan", line: 1 }];

layer(NodeServices.layer)("loadStyleClassIndex", (it) => {
  describe("a class no script spells", () => {
    const fixture = Effect.gen(function* index() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "style-classes-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "style.css"),
        ORPHAN_STYLE_SHEET,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "main.ts"),
        'import "./style.css";\n',
      );
      return loadStyleClassIndex({ repositoryRoot });
    });

    it.effect("is listed under its style sheet", () =>
      Effect.gen(function* program() {
        const index = yield* fixture;
        expect(index).toStrictEqual({
          unusedByStyleSheet: new Map([["src/style.css", ORPHAN_SITES]]),
        });
      }),
    );
  });

  describe("a class a markup file spells", () => {
    const fixture = Effect.gen(function* index() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "style-classes-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "style.css"),
        ORPHAN_STYLE_SHEET,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "index.html"),
        '<div class="orphan"></div>\n',
      );
      return loadStyleClassIndex({ repositoryRoot });
    });

    it.effect("is left out of the index", () =>
      Effect.gen(function* program() {
        const index = yield* fixture;
        expect(index).toStrictEqual({ unusedByStyleSheet: new Map() });
      }),
    );
  });

  describe("a style sheet that vanished after the listing", () => {
    const fixture = Effect.gen(function* index() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "style-classes-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "style.css"),
        ORPHAN_STYLE_SHEET,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", VANISHED_FILE_NAME),
        ".ghost {\n  color: red;\n}\n",
      );
      // mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- whether a style sheet is still there when the boundary reads it is settled between the listing and the read, both of which happen inside the boundary this spec replaces
      vi.mocked(readTextFile).mockImplementation((path) =>
        path.endsWith(VANISHED_FILE_NAME) ? null : readFileSync(path, "utf8"),
      );
      return loadStyleClassIndex({ repositoryRoot });
    });

    it.effect("is left out of the index, and the style sheets beside it stay in", () =>
      Effect.gen(function* program() {
        const index = yield* fixture;
        expect(index).toStrictEqual({
          unusedByStyleSheet: new Map([["src/style.css", ORPHAN_SITES]]),
        });
      }),
    );
  });

  describe("a directory that holds no file at all", () => {
    const fixture = Effect.gen(function* index() {
      const filesystem = yield* FileSystem.FileSystem;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "style-classes-builder-",
      });

      return loadStyleClassIndex({ repositoryRoot });
    });

    it.effect("yields an empty index", () =>
      Effect.gen(function* program() {
        const index = yield* fixture;
        expect(index).toStrictEqual({ unusedByStyleSheet: new Map() });
      }),
    );
  });

  describe("the index of a repository asked for twice", () => {
    const fixture = Effect.gen(function* sameIndexOnASecondAsk() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "style-classes-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "style.css"),
        ORPHAN_STYLE_SHEET,
      );
      return loadStyleClassIndex({ repositoryRoot }) === loadStyleClassIndex({ repositoryRoot });
    });

    it.effect("is built once and handed back on every later ask", () =>
      Effect.gen(function* program() {
        const sameIndexOnASecondAsk = yield* fixture;
        expect(sameIndexOnASecondAsk).toBe(true);
      }),
    );
  });
});
