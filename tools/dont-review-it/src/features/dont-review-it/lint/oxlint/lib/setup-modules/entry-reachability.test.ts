import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { couplingEdgesOf, parsedProgramAt } from "./entry-reachability.ts";

layer(NodeServices.layer)("parsedProgramAt", (it) => {
  describe("a path holding no file", () => {
    const fixture = Effect.gen(function* parsedProgram() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-entry-reachability-",
      });

      return parsedProgramAt(paths.join(root, "never-written.ts"));
    });

    it.effect("parses into no program", () =>
      Effect.gen(function* program() {
        const parsedProgram = yield* fixture;
        expect(parsedProgram).toBe(null);
      }),
    );
  });
});

layer(NodeServices.layer)("couplingEdgesOf", (it) => {
  describe("a path holding no file", () => {
    const fixture = Effect.gen(function* couplingEdges() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-entry-reachability-",
      });

      return couplingEdgesOf(paths.join(root, "never-written.ts"));
    });

    it.effect("couples to nothing", () =>
      Effect.gen(function* program() {
        const couplingEdges = yield* fixture;
        expect(couplingEdges).toStrictEqual([]);
      }),
    );
  });
});
